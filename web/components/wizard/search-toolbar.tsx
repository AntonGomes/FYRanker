import { Search, X } from "lucide-react";

interface SearchToolbarProps {
  searchOpen: boolean;
  searchQuery: string;
  onSearchOpenChange: (open: boolean) => void;
  onSearchQueryChange: (query: string) => void;
  sortDropdown?: React.ReactNode;
}

function SearchInput({
  searchQuery,
  onSearchQueryChange,
  onClose,
}: {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onClose: () => void;
}): React.ReactElement {
  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
      <input
        type="text"
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        autoFocus
        className="w-36 rounded-md border bg-background pl-7 pr-6 py-1 text-xs outline-none focus:ring-1 focus:ring-ring/50 placeholder:text-muted-foreground"
      />
      <button
        onClick={onClose}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function SearchToolbar({
  searchOpen,
  searchQuery,
  onSearchOpenChange,
  onSearchQueryChange,
  sortDropdown,
}: SearchToolbarProps): React.ReactElement {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {searchOpen ? (
        <SearchInput
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          onClose={() => { onSearchQueryChange(""); onSearchOpenChange(false); }}
        />
      ) : (
        <button
          onClick={() => onSearchOpenChange(true)}
          className="flex items-center justify-center h-7 w-7 rounded-md border bg-background text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          title="Search"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
      )}
      {sortDropdown}
    </div>
  );
}
