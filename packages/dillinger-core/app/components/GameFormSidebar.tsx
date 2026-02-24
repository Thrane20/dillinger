interface GameFormSidebarSection {
  id: string;
  label: string;
  icon: string;
  disabled?: boolean;
}

interface GameFormSidebarProps {
  sections: GameFormSidebarSection[];
  activeSection: string;
  onScrollToSection: (sectionId: string) => void;
}

export default function GameFormSidebar({
  sections,
  activeSection,
  onScrollToSection,
}: GameFormSidebarProps) {
  return (
    <nav className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 p-4 sticky top-0 self-start max-h-screen overflow-y-auto hidden lg:block">
      <ul className="space-y-1">
        {sections.map((section) => (
          <li
            key={section.id}
            title={section.disabled ? 'Install the game first to access these settings.' : undefined}
          >
            <button
              type="button"
              onClick={() => onScrollToSection(section.id)}
              disabled={section.disabled}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-300 ease-out flex items-center gap-2 ${
                section.disabled
                  ? 'opacity-40 cursor-not-allowed'
                  : 'opacity-100'
              } ${
                activeSection === section.id
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-text'
              }`}
            >
              <span>{section.icon}</span>
              <span className="text-sm">{section.label}</span>
              {section.disabled && <span className="ml-auto text-xs">🔒</span>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
