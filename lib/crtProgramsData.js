// Shared CRT programme data (used by list and detail pages)

export const CRT_PROGRAMS_DATA = [
  {
    id: "crt-java",
    title: "CRT Java",
    description: "Comprehensive Java training for placement readiness: Core Java, collections, multithreading, and coding rounds.",
    duration: "12–16 weeks",
    image: "/CRTImages/CRT with JAVA.jpg",
    accent: "bg-red-500",
    bg: "bg-red-50",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    iconKey: "code",
  },
  {
    id: "crt-python",
    title: "CRT Python",
    description: "Python CRT program covering fundamentals, DSA, and interview-focused problem solving.",
    duration: "12–16 weeks",
    image: "/CRTImages/CRT with Python fullstack.jpg",
    accent: "bg-amber-500",
    bg: "bg-amber-50",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    iconKey: "code",
  },
  {
    id: "crt-aiml",
    title: "CRT AIML",
    description: "CRT in AI/ML: fundamentals of machine learning, basic deep learning, and project-based practice.",
    duration: "12–16 weeks",
    image: "/CRTImages/CRT with AIML.jpg",
    accent: "bg-violet-500",
    bg: "bg-violet-50",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    iconKey: "cpu",
  },
];

export const CRT_COMMON_200HR = ["Aptitude", "Reasoning", "Soft Skills"];

export const CRT_TECHNICAL_200HR = {
  "crt-java": ["HTML", "CSS", "Java", "SQL", "Advanced Java", "DSA"],
  "crt-python": ["HTML", "CSS", "Python", "SQL", "Advance Python", "DSA"],
  "crt-aiml": ["ML", "AI", "Deep Learning", "Statistics", "Python for ML", "Data Visualization"],
};

export function getProgramBySlug(slug) {
  return CRT_PROGRAMS_DATA.find((p) => p.id === slug) || null;
}
