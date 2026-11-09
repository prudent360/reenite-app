/** A photo for each service category; categories added later in the admin show without one. */
export type Photo = { src: string; alt: string };

export const categoryPhotos: Record<string, Photo> = {
  "business-registration": { src: "/images/home/shop-owner-counter.jpg", alt: "A shop owner behind the counter of her registered business" },
  "tax-compliance": { src: "/images/home/founder-orange-blazer.jpg", alt: "A business owner reviewing her accounts" },
  regulatory: { src: "/images/home/team-meeting.jpg", alt: "A team meeting about their organisation" },
  "online-presence": { src: "/images/home/freelancer-laptop.jpg", alt: "A freelancer working on her laptop" },
};
