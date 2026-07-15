export const EmptyState = ({ icon: Icon, title, description, action, testId = "empty-state" }) => (
  <div data-testid={testId} className="flex flex-col items-center justify-center py-16 px-6 text-center">
    {Icon && (
      <div className="w-14 h-14 rounded-full bg-[#01567A]/5 flex items-center justify-center mb-4">
        <Icon size={26} strokeWidth={1.5} className="text-[#01567A]" />
      </div>
    )}
    <p className="text-[#1F2937] font-medium">{title}</p>
    {description && <p className="text-sm text-[#6B7280] mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);
