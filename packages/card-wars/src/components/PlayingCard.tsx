import { motion } from "framer-motion";
import { asset } from "@/lib/assets";

interface PlayingCardProps {
  rank?: number;
  suit?: string;
  faceDown?: boolean;
  animate?: boolean;
  size?: "sm" | "md" | "lg";
}

const SUIT_MAP: Record<string, string> = {
  hearts: "h",
  diamonds: "d",
  clubs: "c",
  spades: "s",
};

function getCardImagePath(rank: number, suit: string): string {
  const suitCode = SUIT_MAP[suit] || suit.charAt(0).toLowerCase();
  let rankCode: string;

  if (rank === 14) rankCode = "a";
  else if (rank === 13) rankCode = "k";
  else if (rank === 12) rankCode = "q";
  else if (rank === 11) rankCode = "j";
  else rankCode = String(rank);

  return asset(`/cards/${rankCode}${suitCode}.png`);
}

const sizes = {
  sm: "w-16 h-24",
  md: "w-24 h-36",
  lg: "w-32 h-48",
};

export default function PlayingCard({
  rank,
  suit,
  faceDown = false,
  animate = false,
  size = "md",
}: PlayingCardProps) {
  const sizeClass = sizes[size];

  if (faceDown) {
    return (
      <motion.div
        className={`${sizeClass} rounded-sm overflow-hidden shadow-xl relative`}
        initial={animate ? { rotateY: 90, scale: 0.8 } : {}}
        animate={{ rotateY: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <img
          src={asset("/cards/back_of_card.png")}
          alt="Card back"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </motion.div>
    );
  }

  if (!rank || !suit) {
    return (
      <div
        className={`${sizeClass} rounded-lg border-2 border-dashed border-war-border bg-war-card flex items-center justify-center`}
      >
        <span className="text-gray-600 text-xs">Empty</span>
      </div>
    );
  }

  const cardImagePath = getCardImagePath(rank, suit);

  return (
    <motion.div
      className={`${sizeClass} rounded-sm overflow-hidden shadow-xl relative`}
      initial={animate ? { rotateY: 90, scale: 0.8, y: -20 } : {}}
      animate={{ rotateY: 0, scale: 1, y: 0 }}
      transition={{ duration: 0.4, type: "spring" }}
    >
      <img
        src={cardImagePath}
        alt={`${rank} of ${suit}`}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </motion.div>
  );
}
