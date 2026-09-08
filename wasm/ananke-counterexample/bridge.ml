(* The bridge: drive Ananke over the payments domain and answer in JSON.

   Commands cross the boundary as Ananke's own sexp syntax, one per line —
   the same text a scenario file holds. Everything else is the runtime's:
   the trace (with a snapshot after every command) gives the timeline,
   Replay verifies determinism, Diff explains each step, Minimize shrinks a
   failing scenario, Branch forks a future. *)

module Domain_ = Domain
open Base

let version = "ananke 0.1.0 · payments domain v1"

(* ── a minimal JSON emitter ────────────────────────────────────────────── *)
module J = struct
  let str s =
    let b = Buffer.create (String.length s + 2) in
    Buffer.add_char b '"';
    String.iter s ~f:(fun c ->
      match c with
      | '"' -> Buffer.add_string b "\\\""
      | '\\' -> Buffer.add_string b "\\\\"
      | '\n' -> Buffer.add_string b "\\n"
      | '\r' -> Buffer.add_string b "\\r"
      | '\t' -> Buffer.add_string b "\\t"
      | c when Char.to_int c < 0x20 -> Buffer.add_string b (Printf.sprintf "\\u%04x" (Char.to_int c))
      | c -> Buffer.add_char b c);
    Buffer.add_char b '"';
    Buffer.contents b
  ;;

  let int = Int.to_string
  let bool b = if b then "true" else "false"
  let null = "null"
  let list xs = "[" ^ String.concat ~sep:"," xs ^ "]"
  let obj kvs = "{" ^ String.concat ~sep:"," (List.map kvs ~f:(fun (k, v) -> str k ^ ":" ^ v)) ^ "}"
  let sexp s = str (Sexp.to_string s)
end

let state_json (s : Payments.state) =
  J.obj
    [ ( "accounts"
      , J.obj
          (Map.to_alist s.accounts
           |> List.map ~f:(fun (name, (a : Payments.account)) ->
             name, J.obj [ "balance", J.int a.balance; "held", J.int a.held ])) )
    ; ( "payments"
      , J.obj
          (Map.to_alist s.payments
           |> List.map ~f:(fun (id, (p : Payments.payment)) ->
             ( id
             , J.obj
                 [ "payer", J.str p.payer
                 ; "payee", J.str p.payee
                 ; "authorized", J.int p.authorized
                 ; "captured", J.int p.captured
                 ; "refunded", J.int p.refunded
                 ; "closed", J.bool p.closed
                 ] ))) )
    ; "keys", J.int (Set.length s.keys)
    ; "minted", J.int s.minted
    ]
;;

let outcome_json = function
  | Event.Passed { name } -> J.obj [ "name", J.str name; "ok", J.bool true ]
  | Event.Violated { name; message } -> J.obj [ "name", J.str name; "ok", J.bool false; "message", J.str message ]
;;

let command_line c = Sexp.to_string (Payments.sexp_of_command c)

let parse_commands text =
  let lines = String.split_lines text |> List.map ~f:String.strip |> List.filter ~f:(fun l -> not (String.is_empty l)) in
  List.fold_result lines ~init:[] ~f:(fun acc line ->
    match Payments.command_of_sexp (Sexplib.Sexp.of_string line) with
    | c -> Ok (c :: acc)
    | exception exn -> Error (Printf.sprintf "cannot parse %s: %s" line (Exn.to_string exn)))
  |> Result.map ~f:List.rev
;;

(* ── the two domains ───────────────────────────────────────────────────── *)
module Buggy = Payments.Make (struct
    let void_releases_only_the_remainder = false
  end)

module Fixed = Payments.Make (struct
    let void_releases_only_the_remainder = true
  end)

module type PAYMENTS_DOMAIN =
  Domain_.S
  with type state = Payments.state
   and type command = Payments.command
   and type event = Payments.event

module Drive (D : PAYMENTS_DOMAIN) = struct
  module R = Runtime.Make (D)
  module Rep = Replay.Make (D)
  module M = Minimize.Make (D)
  module Br = Branch.Make (D)

  let config mode ~snapshots =
    { Config.rng_seed = 0; invariant_mode = mode; trace_enabled = true; snapshot_each_command = snapshots }
  ;;

  let run config commands = R.run (R.create config) commands

  (* the longest prefix the runtime accepts (monotone: an invalid command
     rejects every longer prefix too) *)
  let longest_ok_prefix config commands =
    let n = List.length commands in
    let ok k =
      match run config (List.take commands k) with
      | Ok r -> Some r
      | Error _ -> None
    in
    match ok n with
    | Some r -> n, r
    | None ->
      let rec search lo lo_result hi =
        if hi - lo <= 1
        then lo, lo_result
        else (
          let mid = (lo + hi) / 2 in
          match ok mid with
          | Some r -> search mid r hi
          | None -> search lo lo_result mid)
      in
      (match ok 0 with
       | Some r0 -> search 0 r0 n
       | None -> assert false)
  ;;

  type step =
    { index : int
    ; command : Sexp.t
    ; events : Sexp.t list
    ; checks : Event.invariant_outcome list
    ; state : Sexp.t option
    }

  (* the timeline is read straight off the trace: Command, Emitted*, the
     invariant outcomes, then the per-command snapshot *)
  let steps_of_trace (trace : Trace.t) =
    let snaps =
      List.sort trace.snapshots ~compare:(fun (a : Snapshot.t) (b : Snapshot.t) ->
        Int.compare (Event_index.to_int a.at_index) (Event_index.to_int b.at_index))
    in
    let flush cur acc = match cur with None -> acc | Some s -> s :: acc in
    let _, _, cur, acc =
      List.fold trace.events ~init:(0, snaps, None, []) ~f:(fun (n, snaps, cur, acc) ev ->
        match ev with
        | Event.Command c ->
          n + 1, snaps, Some { index = n; command = c.payload; events = []; checks = []; state = None }, flush cur acc
        | Event.Emitted s ->
          n, snaps, Option.map cur ~f:(fun st -> { st with events = st.events @ [ s ] }), acc
        | Event.System (Invariant_checked outcomes) ->
          n, snaps, Option.map cur ~f:(fun st -> { st with checks = outcomes }), acc
        | Event.System Snapshot_taken ->
          (match snaps with
           | (snap : Snapshot.t) :: rest ->
             n, rest, Option.map cur ~f:(fun st -> { st with state = Some snap.state }), acc
           | [] -> n, snaps, cur, acc)
        | Event.System Clock_advanced -> n, snaps, cur, acc)
    in
    List.rev (flush cur acc)
  ;;

  let step_json prev_state (s : step) =
    let state_sexp = Option.value s.state ~default:prev_state in
    let changes = Diff.diff prev_state state_sexp |> List.map ~f:(fun c -> J.str (Change.describe c)) in
    ( state_sexp
    , J.obj
        [ "index", J.int s.index
        ; "command", J.sexp s.command
        ; "events", J.list (List.map s.events ~f:J.sexp)
        ; "checks", J.list (List.map s.checks ~f:outcome_json)
        ; "state", state_json (Payments.state_of_sexp state_sexp)
        ; "changes", J.list changes
        ] )
  ;;

  let run_json commands =
    let cfg = config Config.Record ~snapshots:true in
    let accepted, result = longest_ok_prefix cfg commands in
    let rejected =
      if accepted < List.length commands
      then (
        match run cfg (List.take commands (accepted + 1)) with
        | Error e -> Some (accepted, Ananke_error.to_string e)
        | Ok _ -> None)
      else None
    in
    let steps = steps_of_trace result.trace in
    let initial = Payments.sexp_of_state D.initial_state in
    let _, step_jsons =
      List.fold steps ~init:(initial, []) ~f:(fun (prev, acc) s ->
        let next, j = step_json prev s in
        next, j :: acc)
    in
    let stopped_at =
      List.find steps ~f:(fun s -> List.exists s.checks ~f:(function Event.Violated _ -> true | Passed _ -> false))
      |> Option.map ~f:(fun s -> s.index)
    in
    let replay_ok =
      match Rep.replay result.trace cfg with
      | Error _ -> false
      | Ok replayed -> (match Rep.verify result.trace replayed with Ok () -> true | Error _ -> false)
    in
    (* the exact error a Stop-mode run reports — what minimize will hunt for *)
    let stop_error =
      match run (config Config.Stop ~snapshots:false) commands with
      | Ok _ -> None
      | Error e -> Some (Ananke_error.to_string e)
    in
    J.obj
      [ "ok", J.bool true
      ; "domain", J.str D.name
      ; "steps", J.list (List.rev step_jsons)
      ; "stopped_at", Option.value_map stopped_at ~default:J.null ~f:J.int
      ; "stop_error", Option.value_map stop_error ~default:J.null ~f:J.str
      ; ( "rejected"
        , Option.value_map rejected ~default:J.null ~f:(fun (i, e) -> J.obj [ "index", J.int i; "error", J.str e ]) )
      ; "replay_ok", J.bool replay_ok
      ; "events", J.int (Trace.event_count result.trace)
      ]
  ;;

  let minimize_json commands =
    let cfg = config Config.Stop ~snapshots:false in
    match run cfg commands with
    | Ok _ -> J.obj [ "ok", J.bool false; "reason", J.str "the scenario does not fail" ]
    | Error expected ->
      (* "still fails" means: the same invariant is violated (its message
         carries amounts, which legitimately change as commands are dropped);
         any other kind of error must match exactly *)
      let invariant_of = function
        | Ananke_error.Invariant_violation m -> Some (List.hd_exn (String.split m ~on:':'))
        | _ -> None
      in
      let same_failure actual =
        match invariant_of expected, invariant_of actual with
        | Some a, Some b -> String.equal a b
        | _ -> Ananke_error.equal expected actual
      in
      let log = ref [] in
      let fails candidate =
        let f =
          match run cfg candidate with
          | Ok _ -> false
          | Error actual -> same_failure actual
        in
        log := (List.length candidate, f) :: !log;
        f
      in
      let r = M.minimize cfg ~fails commands in
      J.obj
        [ "ok", J.bool true
        ; "error", J.str (Ananke_error.to_string expected)
        ; "original", J.int (List.length r.original)
        ; "minimized", J.list (List.map r.minimized ~f:(fun c -> J.str (command_line c)))
        ; "attempts", J.int r.attempts
        ; "log", J.list (List.rev_map !log ~f:(fun (n, f) -> J.obj [ "length", J.int n; "fails", J.bool f ]))
        ]
  ;;

  let violations_json (t : Trace.t) = J.list (List.map (Trace.invariant_violations t) ~f:outcome_json)

  let final_json (t : Trace.t) =
    match t.final_state with
    | Some s -> state_json (Payments.state_of_sexp s)
    | None -> J.null
  ;;

  let branch_json ~prefix ~baseline ~alternate =
    let cfg = config Config.Record ~snapshots:false in
    match Br.fork cfg ~prefix ~baseline_suffix:baseline ~alternate_suffix:alternate with
    | Error e -> J.obj [ "ok", J.bool false; "error", J.str (Ananke_error.to_string e) ]
    | Ok b ->
      J.obj
        [ "ok", J.bool true
        ; "diverged", J.bool (Branch.diverged b)
        ; "forked_after", J.int (List.length prefix)
        ; "changes", J.list (List.map b.state_diff ~f:(fun c -> J.str (Change.describe c)))
        ; "baseline", J.obj [ "state", final_json b.baseline; "violations", violations_json b.baseline ]
        ; "alternate", J.obj [ "state", final_json b.alternate; "violations", violations_json b.alternate ]
        ]
  ;;
end

module Drive_buggy = Drive (Buggy)
module Drive_fixed = Drive (Fixed)

let with_domain name f_buggy f_fixed =
  match name with
  | "fixed" | "payments_fixed" -> f_fixed ()
  | _ -> f_buggy ()
;;

let error_json msg = J.obj [ "ok", J.bool false; "error", J.str msg ]

let run_json domain text =
  match parse_commands text with
  | Error e -> error_json e
  | Ok commands -> with_domain domain (fun () -> Drive_buggy.run_json commands) (fun () -> Drive_fixed.run_json commands)
;;

let minimize_json domain text =
  match parse_commands text with
  | Error e -> error_json e
  | Ok commands ->
    with_domain domain (fun () -> Drive_buggy.minimize_json commands) (fun () -> Drive_fixed.minimize_json commands)
;;

let branch_json domain prefix_text baseline_text alternate_text =
  match parse_commands prefix_text, parse_commands baseline_text, parse_commands alternate_text with
  | Error e, _, _ | _, Error e, _ | _, _, Error e -> error_json e
  | Ok prefix, Ok baseline, Ok alternate ->
    with_domain
      domain
      (fun () -> Drive_buggy.branch_json ~prefix ~baseline ~alternate)
      (fun () -> Drive_fixed.branch_json ~prefix ~baseline ~alternate)
;;

(* ── scenarios: generated with Ananke's own deterministic RNG ──────────── *)

type model_payment =
  { m_payer : string
  ; m_payee : string
  ; m_authorized : int
  ; mutable m_captured : int
  ; mutable m_refunded : int
  ; mutable m_closed : bool
  }

(* The generator's world: a model of the payment system just good enough to
   only ever issue commands a correct system would accept, so every failure
   the runtime finds is the domain's, not the scenario's. *)
type gen =
  { mutable rng : Rng.t
  ; balances : (string, int) Hashtbl.t
  ; mutable payments : (string * model_payment) list
  ; mutable keys : int
  ; mutable issued : Payments.command list
  ; mutable commands : Payments.command list
  }

let names = [ "alice"; "bob"; "carol"; "dave" ]
let opening = [ 1000; 800; 600; 400 ]

let pick g n =
  if n <= 0
  then 0
  else (
    let r, v = Rng.int g.rng ~exclusive_upper_bound:n in
    g.rng <- r;
    v)
;;

let next_key g =
  g.keys <- g.keys + 1;
  Printf.sprintf "k%d" g.keys
;;

let round10 x = Int.max 10 (x / 10 * 10)
let emit g c = g.commands <- c :: g.commands

(* a fresh command: remembered for redelivery, then emitted *)
let issue g c =
  g.issued <- c :: g.issued;
  emit g c;
  true
;;

let authorize g =
  let payers = List.filter names ~f:(fun n -> Hashtbl.find_exn g.balances n >= 60) in
  match payers with
  | [] -> false
  | _ ->
    let payer = List.nth_exn payers (pick g (List.length payers)) in
    let others = List.filter names ~f:(fun n -> not (String.equal n payer)) in
    let payee = List.nth_exn others (pick g (List.length others)) in
    let bal = Hashtbl.find_exn g.balances payer in
    let amount = round10 (50 + pick g (Int.min 400 (bal - 50))) in
    let id = Printf.sprintf "p%d" (List.length g.payments + 1) in
    Hashtbl.set g.balances ~key:payer ~data:(bal - amount);
    g.payments
    <- g.payments @ [ id, { m_payer = payer; m_payee = payee; m_authorized = amount; m_captured = 0; m_refunded = 0; m_closed = false } ];
    issue g (Payments.Authorize { key = next_key g; payment = id; payer; payee; amount })
;;

let open_with_remaining g = List.filter g.payments ~f:(fun (_, p) -> (not p.m_closed) && p.m_authorized - p.m_captured > 0)

let capture g =
  match open_with_remaining g with
  | [] -> false
  | cands ->
    let id, p = List.nth_exn cands (pick g (List.length cands)) in
    let remaining = p.m_authorized - p.m_captured in
    let amount = if remaining > 10 && pick g 10 < 7 then round10 (remaining / 2) else remaining in
    p.m_captured <- p.m_captured + amount;
    Hashtbl.update g.balances p.m_payee ~f:(fun v -> Option.value v ~default:0 + amount);
    issue g (Payments.Capture { key = next_key g; payment = id; amount })
;;

let refund g =
  let cands =
    List.filter g.payments ~f:(fun (_, p) ->
      p.m_captured - p.m_refunded >= 10 && Hashtbl.find_exn g.balances p.m_payee >= p.m_captured - p.m_refunded)
  in
  match cands with
  | [] -> false
  | _ ->
    let id, p = List.nth_exn cands (pick g (List.length cands)) in
    let refundable = p.m_captured - p.m_refunded in
    let amount = if refundable > 10 && pick g 2 = 0 then round10 (refundable / 2) else refundable in
    p.m_refunded <- p.m_refunded + amount;
    Hashtbl.update g.balances p.m_payee ~f:(fun v -> Option.value v ~default:0 - amount);
    Hashtbl.update g.balances p.m_payer ~f:(fun v -> Option.value v ~default:0 + amount);
    issue g (Payments.Refund { key = next_key g; payment = id; amount })
;;

let void g =
  match List.filter g.payments ~f:(fun (_, p) -> not p.m_closed) with
  | [] -> false
  | cands ->
    let id, p = List.nth_exn cands (pick g (List.length cands)) in
    p.m_closed <- true;
    (* the model releases only the remainder — what a correct system does *)
    Hashtbl.update g.balances p.m_payer ~f:(fun v -> Option.value v ~default:0 + (p.m_authorized - p.m_captured));
    issue g (Payments.Void { key = next_key g; payment = id })
;;

let retry g =
  match g.issued with
  | [] -> false
  | cs ->
    (* a redelivery of an earlier command, same idempotency key *)
    emit g (List.nth_exn cs (pick g (Int.min 6 (List.length cs))));
    true
;;

(* one command per step, rolled by weight; when the roll finds nothing to do,
   an authorization or a capture almost always can *)
let rec fill g n =
  if n <= 0
  then ()
  else (
    let roll = pick g 100 in
    let done_ =
      if roll < 34 then authorize g
      else if roll < 64 then capture g
      else if roll < 74 then refund g
      else if roll < 90 then void g
      else retry g
    in
    let done_ = done_ || authorize g || capture g in
    fill g (if done_ then n - 1 else n))
;;

let scenario ~seed ~length =
  let g =
    { rng = Rng.create seed
    ; balances = Hashtbl.create (module String)
    ; payments = []
    ; keys = 0
    ; issued = []
    ; commands = List.map2_exn names opening ~f:(fun name balance -> Payments.Open_account { name; balance })
    }
  in
  List.iter2_exn names opening ~f:(fun n b -> Hashtbl.set g.balances ~key:n ~data:b);
  fill g (Int.max 0 (length - List.length names));
  List.rev g.commands
;;

let scenario_json ~seed ~length =
  let commands = scenario ~seed ~length in
  J.obj
    [ "seed", J.int seed
    ; "commands", J.list (List.map commands ~f:(fun c -> J.str (command_line c)))
    ]
;;
