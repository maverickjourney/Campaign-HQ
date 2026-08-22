import markBlack
  from "../../../assets/brand/campaign-seat/campaign-seat-mark-black.svg";

import markWhite
  from "../../../assets/brand/campaign-seat/campaign-seat-mark-white.svg";

import wordmarkBlack
  from "../../../assets/brand/campaign-seat/campaign-seat-wordmark-black.png";

import wordmarkWhite
  from "../../../assets/brand/campaign-seat/campaign-seat-wordmark-white.png";

import styles
  from "./SeatBrand.module.css";

const assets = {
  mark: {
    black: markBlack,
    white: markWhite,
  },
  wordmark: {
    black: wordmarkBlack,
    white: wordmarkWhite,
  },
};

export default function SeatBrand({
  variant = "wordmark",
  color = "black",
  className = "",
  alt = "Campaign Seat",
}) {
  const source =
    assets[variant]?.[color] ||
    assets.wordmark.black;

  return (
    <img
      src={source}
      alt={alt}
      className={[
        styles.logo,
        styles[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      draggable="false"
    />
  );
}
