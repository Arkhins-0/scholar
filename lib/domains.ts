/** Predetermined research domains offered in the proposal dropdown. */
export const RESEARCH_DOMAINS = [
  "Artificial Intelligence & Machine Learning",
  "Data Science & Analytics",
  "Computer Networks & Security",
  "Software Engineering",
  "Internet of Things & Embedded Systems",
  "VLSI & Microelectronics",
  "Communication & Signal Processing",
  "Power Systems & Power Electronics",
  "Control & Automation",
  "Mechanical Design & Manufacturing",
  "Thermal & Fluid Engineering",
  "Civil & Structural Engineering",
  "Environmental Engineering",
  "Biotechnology & Biomedical Engineering",
  "Materials Science & Nanotechnology",
  "Mathematics & Computational Sciences",
  "Physics",
  "Chemistry",
  "Management Studies",
  "Humanities & Social Sciences",
] as const;

export type ResearchDomain = (typeof RESEARCH_DOMAINS)[number];
