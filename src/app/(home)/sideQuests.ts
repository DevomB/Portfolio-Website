/**
 * Side quests: things built for joy, not for the portfolio. They get a
 * screenshot, one line, and a link out — never a project page or a demo.
 * Two of them, side by side, half the shell each.
 */

export type SideQuest = {
  name: string;
  /** One line. Quotation marks when it is a quote, sentence case when it is mine. */
  blurb: string;
  /** Where the card links. The live site. */
  url: string;
  repo: string;
  /** Screenshot under public/, 16:9. */
  image: string;
};

export const sideQuests: SideQuest[] = [
  {
    name: "Iron Man",
    blurb: "“Genius, billionaire, playboy, philanthropist”",
    url: "https://iron-man.devomb.com",
    repo: "https://github.com/DevomB/Iron-Man",
    image: "/images/side-quests/iron-man.jpg",
  },
  {
    name: "Spider Man",
    blurb: "Guess who my favorite superhero is",
    url: "https://spiderman.devomb.com",
    repo: "https://github.com/DevomB/Spiderman",
    image: "/images/side-quests/spiderman.jpg",
  },
];
