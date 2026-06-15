import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HostAvatar } from "@/components/HostAvatar";
import { createReview, updateDriverRatingAggregate } from "@/data/appwrite-repository";
import { HOST_TAGS, PASSENGER_TAGS } from "@/lib/reviewTags";
import type { ReviewDirection } from "@/lib/domain";

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  direction: ReviewDirection;
  tripId: string;
  bookingId: string;
  toUserId: string;
  toUserName: string;
  toUserPhoto?: string | null;
  fromUserId: string;
  onSuccess?: () => void;
}

export function ReviewModal({
  open,
  onClose,
  direction,
  tripId,
  bookingId,
  toUserId,
  toUserName,
  toUserPhoto,
  fromUserId,
  onSuccess,
}: ReviewModalProps) {
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const tagOptions = direction === "guest_to_host" ? HOST_TAGS : PASSENGER_TAGS;
  const currentTags = stars > 0 ? (tagOptions[stars] ?? []) : [];

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  };

  const handleStarClick = (val: number) => {
    setStars(val);
    setSelectedTags(new Set());
  };

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async () => {
      await createReview({
        tripId,
        bookingId,
        fromUserId,
        toUserId,
        direction,
        stars,
        tags: [...selectedTags],
      });
      if (direction === "guest_to_host") {
        await updateDriverRatingAggregate(toUserId);
      }
    },
    onSuccess: () => {
      toast.success("Review submitted!");
      setStars(0);
      setSelectedTags(new Set());
      onClose();
      onSuccess?.();
    },
    onError: () => {
      toast.error("Failed to submit review. Please try again.");
    },
  });

  const label =
    stars === 5
      ? direction === "guest_to_host"
        ? "Excellent Driver"
        : "Excellent Traveler"
      : stars === 4
        ? "Very Good"
        : stars === 3
          ? "Good Experience"
          : stars === 2
            ? "Below Average"
            : stars === 1
              ? "Poor Experience"
              : "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl p-6">
        <DialogHeader>
          <div className="flex flex-col items-center gap-3 text-center">
            <HostAvatar name={toUserName} photoUrl={toUserPhoto} size={56} />
            <DialogTitle className="text-base font-bold text-gray-900">
              How was your experience with {toUserName}?
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-5">
          {/* Star picker */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                onClick={() => handleStarClick(val)}
                onMouseEnter={() => setHovered(val)}
                onMouseLeave={() => setHovered(0)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  (hovered || stars) >= val
                    ? "bg-amber-400 text-white scale-110 shadow-md"
                    : "bg-gray-100 text-gray-300 hover:bg-gray-200"
                }`}
              >
                <Star
                  size={24}
                  fill={(hovered || stars) >= val ? "white" : "transparent"}
                  strokeWidth={2.5}
                />
              </button>
            ))}
          </div>

          {stars > 0 && (
            <p className="text-center text-sm font-semibold text-amber-600">{label}</p>
          )}

          {/* Tag chips */}
          {currentTags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {currentTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                    selectedTags.has(tag)
                      ? "bg-emerald-50 text-emerald-700 border-emerald-400"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-emerald-300"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          <Button
            className="w-full rounded-2xl h-11 font-bold"
            variant="hero"
            style={{ color: "#fff" }}
            disabled={isPending || stars === 0 || selectedTags.size === 0}
            onClick={() => submit()}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting…
              </>
            ) : (
              "Submit Review"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
