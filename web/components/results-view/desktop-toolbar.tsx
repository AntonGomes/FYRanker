"use client";

import { Button } from "@/components/ui/button";
import {
  Search,
  Columns2,
  Download,
  Upload,
  HelpCircle,
  Undo2,
  Redo2,
} from "lucide-react";
import type { ToolbarProps } from "@/components/results-view/types";

function ProgrammeCount(props: {
  filtered: number;
  total: number;
}): React.ReactNode {
  if (props.filtered === props.total) {
    return `${props.total} programmes`;
  }
  return `${props.filtered} of ${props.total} programmes`;
}

function SearchInput(props: {
  value: string;
  onChange: (v: string) => void;
}): React.ReactNode {
  return (
    <div className="relative flex-1 min-w-[200px] max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        placeholder="Search programmes, hospitals, specialties..."
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground"
      />
    </div>
  );
}

function FilterSelect(props: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: string[];
  className?: string;
}): React.ReactNode {
  return (
    <select
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      className={`rounded-md border bg-background px-3 py-2 text-sm outline-none ${props.className ?? ""}`}
    >
      <option value="all">{props.label}</option>
      {props.options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function UndoRedoButtons(props: {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}): React.ReactNode {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Button size="sm" variant="ghost" className="gap-1 text-xs px-2" onClick={props.onUndo} disabled={!props.canUndo} title="Undo">
        <Undo2 className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" className="gap-1 text-xs px-2" onClick={props.onRedo} disabled={!props.canRedo} title="Redo">
        <Redo2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ExportImportButtons(props: {
  onExport: () => void;
  onImportClick: () => void;
}): React.ReactNode {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={props.onExport}>
        <Download className="h-3.5 w-3.5" />
        Export .xlsx
      </Button>
      <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={props.onImportClick}>
        <Upload className="h-3.5 w-3.5" />
        Import
      </Button>
    </div>
  );
}

function FilterRow(props: ToolbarProps): React.ReactNode {
  const { filters, filterActions } = props;

  return (
    <>
      <SearchInput value={filters.searchQuery} onChange={filterActions.setSearchQuery} />
      <FilterSelect value={filters.regionFilter} onChange={filterActions.setRegionFilter} label="All Regions" options={props.allRegions} className="min-w-[140px]" />
      <FilterSelect value={filters.hospitalFilter} onChange={filterActions.setHospitalFilter} label="All Hospitals" options={props.allHospitals} className="min-w-[160px] max-w-[220px]" />
      <FilterSelect value={filters.specialtyFilter} onChange={filterActions.setSpecialtyFilter} label="All Specialties" options={props.allSpecialties} className="min-w-[160px] max-w-[220px]" />
      {props.hasActiveFilters && (
        <button onClick={filterActions.clearFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
          Clear filters
        </button>
      )}
    </>
  );
}

function ActionButtons(props: ToolbarProps): React.ReactNode {
  return (
    <>
      {props.compareCount >= 2 && (
        <Button size="sm" variant="secondary" onClick={props.onShowCompare} className="gap-1 text-sm shrink-0">
          <Columns2 className="h-4 w-4" />
          Compare ({props.compareCount})
        </Button>
      )}
      <ExportImportButtons onExport={props.onExport} onImportClick={props.onImportClick} />
      <UndoRedoButtons onUndo={props.onUndo} onRedo={props.onRedo} canUndo={props.canUndo} canRedo={props.canRedo} />
      <button onClick={props.onShowHelp} className="ml-auto p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0" title="Help">
        <HelpCircle className="h-5 w-5" />
      </button>
    </>
  );
}

export function DesktopToolbar(props: ToolbarProps): React.ReactNode {
  return (
    <div className="shrink-0 border-b bg-gradient-to-r from-secondary/20 via-accent/10 to-secondary/20 px-4 py-3 hidden sm:block">
      <div className="max-w-[1800px] mx-auto flex items-center gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground shrink-0">
          <ProgrammeCount filtered={props.filteredCount} total={props.totalCount} />
        </p>
        <FilterRow {...props} />
        <ActionButtons {...props} />
      </div>
    </div>
  );
}
