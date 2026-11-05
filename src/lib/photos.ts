/**
 * Licensed photography library.
 *
 * Every file in `/public/images/photos` comes from Pexels and is covered by the
 * Pexels License (https://www.pexels.com/license/): free for commercial use,
 * modification allowed, attribution not required. Source pages are recorded in
 * `photoCredits` below so provenance stays auditable.
 *
 * Photos are intentionally mapped one-to-one to placements: a photograph is not
 * reused twice within the same page, and the layout-specific `object-cover`
 * crops are chosen in the components (portrait frame vs. wide band vs. card).
 */

export const photo = {
  teamOffice: "/images/photos/team-office.jpg",
  teamLounge: "/images/photos/team-lounge.jpg",
  teamTablet: "/images/photos/team-tablet.jpg",
  doctorPortrait: "/images/photos/doctor-portrait.jpg",
  reception: "/images/photos/reception.jpg",
  laptopNotes: "/images/photos/laptop-notes.jpg",
  stethoscopeNotes: "/images/photos/stethoscope-notes.jpg",
  analyticsLaptop: "/images/photos/analytics-laptop.jpg",
  deskCharts: "/images/photos/desk-charts.jpg",
  presentation: "/images/photos/presentation.jpg",
  supportDesk: "/images/photos/support-desk.jpg",
  supportHeadset: "/images/photos/support-headset.jpg",
  videoConsult: "/images/photos/video-consult.jpg",
  doctorFemale: "/images/photos/doctor-female.jpg",
  doctorDoorway: "/images/photos/doctor-doorway.jpg",
  corridorBright: "/images/photos/corridor-bright.jpg",
  corridorHospital: "/images/photos/corridor-hospital.jpg",
  documentsReview: "/images/photos/documents-review.jpg",
  doctorsDiscussing: "/images/photos/doctors-discussing.jpg",
  documentsTeam: "/images/photos/documents-team.jpg",
  documentsDesk: "/images/photos/documents-desk.jpg",
  keyboard: "/images/photos/keyboard.jpg",
  executiveMeeting: "/images/photos/executive-meeting.jpg",
} as const;

export type PhotoPath = (typeof photo)[keyof typeof photo];

export interface PhotoCredit {
  file: string;
  source: "Pexels";
  sourceUrl: string;
  license: string;
}

const PEXELS_LICENSE = "Pexels License — free for commercial use, no attribution required";

/** Provenance for every downloaded photograph (all Pexels, all clear-licensed). */
export const photoCredits: PhotoCredit[] = [
  { file: "/images/photos/team-office.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/36765727/", license: PEXELS_LICENSE },
  { file: "/images/photos/team-lounge.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/8276332/", license: PEXELS_LICENSE },
  { file: "/images/photos/team-tablet.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/5355709/", license: PEXELS_LICENSE },
  { file: "/images/photos/doctor-portrait.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/33055506/", license: PEXELS_LICENSE },
  { file: "/images/photos/reception.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/4269203/", license: PEXELS_LICENSE },
  { file: "/images/photos/laptop-notes.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/20955055/", license: PEXELS_LICENSE },
  { file: "/images/photos/stethoscope-notes.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/8621905/", license: PEXELS_LICENSE },
  { file: "/images/photos/analytics-laptop.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/7693224/", license: PEXELS_LICENSE },
  { file: "/images/photos/desk-charts.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/5717072/", license: PEXELS_LICENSE },
  { file: "/images/photos/presentation.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/7413916/", license: PEXELS_LICENSE },
  { file: "/images/photos/support-desk.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/7709173/", license: PEXELS_LICENSE },
  { file: "/images/photos/support-headset.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/8866825/", license: PEXELS_LICENSE },
  { file: "/images/photos/video-consult.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/7195310/", license: PEXELS_LICENSE },
  { file: "/images/photos/doctor-female.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/8376223/", license: PEXELS_LICENSE },
  { file: "/images/photos/doctor-doorway.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/5327871/", license: PEXELS_LICENSE },
  { file: "/images/photos/corridor-bright.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/37036967/", license: PEXELS_LICENSE },
  { file: "/images/photos/corridor-hospital.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/11288653/", license: PEXELS_LICENSE },
  { file: "/images/photos/documents-review.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/7414023/", license: PEXELS_LICENSE },
  { file: "/images/photos/doctors-discussing.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/6129205/", license: PEXELS_LICENSE },
  { file: "/images/photos/documents-team.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/6914022/", license: PEXELS_LICENSE },
  { file: "/images/photos/documents-desk.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/7654600/", license: PEXELS_LICENSE },
  { file: "/images/photos/keyboard.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/31421514/", license: PEXELS_LICENSE },
  { file: "/images/photos/executive-meeting.jpg", source: "Pexels", sourceUrl: "https://www.pexels.com/photo/professional-business-meeting-in-modern-office-36714213/", license: PEXELS_LICENSE },
];
