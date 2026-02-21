"use client";

import { cn } from "@/lib/utils";
import {
  Search,
  X,
  Download,
  Upload,
  SlidersHorizontal,
  HelpCircle,
  Undo2,
  Redo2,
} from "lucide-react";
import type { MobileToolbarProps } from "@/components/results-view/types";

function MobileSearchBar(props: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}): React.ReactNode {
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search programmes, hospitals, specialties..."
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          autoFocus
          className="w-full rounded-md border bg-background pl-8 pr-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground"
        />
      </div>
      <button
        onClick={props.onClose}
        className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
        title="Close search"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function MobileIconButton(props: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}): React.ReactNode {
  const baseClass =
    "p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md transition-colors shrink-0";
  const disabledClass = props.disabled
    ? "text-muted-foreground/30"
    : "text-muted-foreground hover:text-foreground hover:bg-muted";

  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className={cn(baseClass, props.className ?? disabledClass)}
      title={props.title}
    >
      {props.children}
    </button>
  );
}

function MobileButtonRow(props: MobileToolbarProps): React.ReactNode {
  return (
    <div className="flex items-center gap-0.5">
      <p className="text-xs font-medium text-muted-foreground shrink-0 px-1">
        {props.filteredCount === props.totalCount
          ? `${props.totalCount}`
          : `${props.filteredCount}/${props.totalCount}`}
      </p>

      <button
        onClick={() => props.setMobileFiltersOpen((o: boolean) => !o)}
        className={cn(
          "relative p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md transition-colors shrink-0",
          props.mobileFiltersOpen
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
        title="Filters"
      >
        <SlidersHorizontal className="h-4 w-4" />
        {props.hasActiveFilters && !props.mobileFiltersOpen && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
        )}
      </button>

      <MobileIconButton onClick={() => props.setMobileSearchOpen(true)} title="Search">
        <Search className="h-4 w-4" />
      </MobileIconButton>

      <MobileIconButton onClick={props.onExport} title="Export">
        <Download className="h-4 w-4" />
      </MobileIconButton>

      <MobileIconButton onClick={props.onImportClick} title="Import">
        <Upload className="h-4 w-4" />
      </MobileIconButton>

      <MobileIconButton onClick={props.onUndo} disabled={!props.canUndo} title="Undo">
        <Undo2 className="h-4 w-4" />
      </MobileIconButton>

      <MobileIconButton onClick={props.onRedo} disabled={!props.canRedo} title="Redo">
        <Redo2 className="h-4 w-4" />
      </MobileIconButton>

      <MobileIconButton
        onClick={props.onShowHelp}
        title="Help"
        className="text-muted-foreground hover:text-foreground hover:bg-muted ml-auto p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md transition-colors shrink-0"
      >
        <HelpCircle className="h-4 w-4" />
      </MobileIconButton>
    </div>
  );
}

function MobileFilterDropdown(props: {
  filters: MobileToolbarProps["filters"];
  filterActions: MobileToolbarProps["filterActions"];
  allRegions: string[];
  allHospitals: string[];
  allSpecialties: string[];
  hasActiveFilters: boolean;
}): React.ReactNode {
  const selectClass = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none";

  return (
    <div className="mt-2 space-y-2">
      <select value={props.filters.regionFilter} onChange={(e) => props.filterActions.setRegionFilter(e.target.value)} className={selectClass}>
        <option value="all">All Regions</option>
        {props.allRegions.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      <select value={props.filters.hospitalFilter} onChange={(e) => props.filterActions.setHospitalFilter(e.target.value)} className={selectClass}>
        <option value="all">All Hospitals</option>
        {props.allHospitals.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>

      <select value={props.filters.specialtyFilter} onChange={(e) => props.filterActions.setSpecialtyFilter(e.target.value)} className={selectClass}>
        <option value="all">All Specialties</option>
        {props.allSpecialties.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {props.hasActiveFilters && (
        <button
          onClick={props.filterActions.clearFilters}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

export function MobileToolbar(props: MobileToolbarProps): React.ReactNode {
  return (
    <div className="shrink-0 border-b bg-gradient-to-r from-secondary/20 via-accent/10 to-secondary/20 px-2 py-1.5 sm:hidden">
      {props.mobileSearchOpen ? (
        <MobileSearchBar
          value={props.filters.searchQuery}
          onChange={props.filterActions.setSearchQuery}
          onClose={() => {
            props.setMobileSearchOpen(false);
            props.filterActions.setSearchQuery("");
          }}
        />
      ) : (
        <MobileButtonRow {...props} />
      )}

      {props.mobileFiltersOpen && !props.mobileSearchOpen && (
        <MobileFilterDropdown
          filters={props.filters}
          filterActions={props.filterActions}
          allRegions={props.allRegions}
          allHospitals={props.allHospitals}
          allSpecialties={props.allSpecialties}
          hasActiveFilters={props.hasActiveFilters}
        />
      )}
    </div>
  );
}
