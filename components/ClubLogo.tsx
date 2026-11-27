import { publicAsset } from "@/lib/app-base";

const SIZES = {
  header: "h-9 w-9 sm:h-11 sm:w-11",
  login: "h-14 w-14",
  tv: "h-[6.5vh] w-[6.5vh] min-h-12 min-w-12",
} as const;

export type ClubLogoSize = keyof typeof SIZES;

/** HBS Academy crest. On a red or dark bar, `plate` puts it on a white disc so the mark stays crisp. */
export function ClubLogo({ plate = false, size = "header" }: { plate?: boolean; size?: ClubLogoSize }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${
        plate ? "rounded-full bg-white p-0.5 shadow-sm ring-1 ring-black/10" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={publicAsset("/hbs-academy-logo.png")}
        alt="HBS Academy"
        className={`${SIZES[size]} object-contain`}
      />
    </span>
  );
}
