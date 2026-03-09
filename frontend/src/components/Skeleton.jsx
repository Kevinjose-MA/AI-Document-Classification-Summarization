// components/Skeleton.jsx

const S = ({ cls }) => <div className={`shimmer rounded ${cls}`} />;

export function SkeletonKpi() {
  return (
    <div className="panel p-5 space-y-3">
      <div className="flex justify-between items-start">
        <S cls="h-3 w-28" />
        <S cls="h-9 w-9 rounded-xl" />
      </div>
      <S cls="h-8 w-20" />
      <S cls="h-2.5 w-24" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <tr className="border-b border-[#EEF2F8]">
      {[8, 48, 20, 16, 16, 14, 14].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <S cls={`h-3.5 w-${w}`} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCard() {
  return (
    <div className="panel p-5 space-y-4">
      <div className="flex gap-3 items-start">
        <S cls="h-9 w-9 rounded-lg" />
        <div className="flex-1 space-y-2">
          <S cls="h-3.5 w-3/4" />
          <S cls="h-3 w-1/2" />
        </div>
        <S cls="h-5 w-16 rounded-full" />
      </div>
      <div className="pt-3 border-t border-[#EEF2F8] flex justify-between">
        <S cls="h-5 w-16 rounded-full" />
        <S cls="h-3 w-20" />
      </div>
    </div>
  );
}

export function SkeletonInsight() {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#EEF2F8] last:border-0">
      <S cls="h-7 w-7 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <S cls="h-3.5 w-4/5" />
        <S cls="h-3 w-3/5" />
      </div>
    </div>
  );
}