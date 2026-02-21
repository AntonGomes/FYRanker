"use client";

import { useMemo, useCallback, useEffect, useRef } from "react";
import { DndContext, DragOverlay, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence } from "framer-motion";
import type { ScoredJob } from "@/lib/scoring";
import { computeNudgeAmount } from "@/lib/scoring";
import { JobDetailPanel } from "@/components/job-detail-panel";
import { MoveToDialog } from "@/components/move-to-dialog";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { ListDragOverlayRow } from "@/components/results-view/list-row";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/site-header";
import { WelcomeModal } from "@/components/welcome-modal";
import { exportRankingsToXlsx } from "@/lib/export-xlsx";
import { importRankingsFromXlsx, ImportError } from "@/lib/import-xlsx";
import { useListDragSensors } from "@/hooks/use-list-drag-sensors";
import { useUndoState } from "@/hooks/use-undo-state";
import { useFilterState } from "@/hooks/use-filter-state";
import { useBulkActions } from "@/hooks/use-bulk-actions";
import { useNudgeAnimation } from "@/hooks/use-nudge-animation";
import { DesktopToolbar } from "@/components/results-view/desktop-toolbar";
import { MobileToolbar } from "@/components/results-view/mobile-toolbar";
import { CompareModal } from "@/components/results-view/compare-modal";
import { GhostOverlay, CascadeGhostOverlay } from "@/components/results-view/ghost-overlays";
import { ColumnHeader } from "@/components/results-view/column-header";
import { VirtualList } from "@/components/results-view/virtual-list";
import { PinnedRows } from "@/components/results-view/pinned-rows";
import { handleDragEnd as dndDragEnd } from "@/components/results-view/dnd-handlers";
import { useMobileDetect, useSaveToStorage, useEdgeGlowTimer, useUIState, useCustomCollision, useRowDataGetter, buildIndexById, computePinnedIndices } from "@/components/results-view/use-results-hooks";
import { ROW_HEIGHT_DESKTOP, ROW_HEIGHT_MOBILE, VIRTUALIZER_OVERSCAN } from "@/components/results-view/constants";

function EdgeGlowBar(props: { edgeGlow: { side: "top" | "bottom"; color: "green" | "red" } | null; onEnd: () => void }): React.ReactNode {
  if (!props.edgeGlow) return null;
  return <div className={cn("absolute left-0 right-0 h-14 z-30 pointer-events-none", props.edgeGlow.side === "top" ? "top-0" : "bottom-0", props.edgeGlow.color === "green" ? "edge-glow-green" : "edge-glow-red")} onAnimationEnd={props.onEnd} />;
}

export function ResultsView(props: { scoredJobs: ScoredJob[] }) {
  const undo = useUndoState(props.scoredJobs), isMobile = useMobileDetect(), filter = useFilterState(undo.rankedJobs);
  const bulk = useBulkActions(), nudge = useNudgeAnimation(), sensors = useListDragSensors(), ui = useUIState();
  const scrollRef = useRef<HTMLDivElement>(null), contentRef = useRef<HTMLDivElement>(null), importFileRef = useRef<HTMLInputElement>(null), scrollToJobIdRef = useRef<string | null>(null);
  const nudgeAmount = useMemo(() => computeNudgeAmount(undo.rankedJobs), [undo.rankedJobs]), indexById = useMemo(() => buildIndexById(undo.rankedJobs), [undo.rankedJobs]);
  const filteredIds = useMemo(() => filter.filteredJobs.map((s) => s.job.programmeTitle), [filter.filteredJobs]), pinnedRowIndices = useMemo(() => computePinnedIndices(filter.filteredJobs, bulk.pinnedJobIds), [filter.filteredJobs, bulk.pinnedJobIds]);
  const virtualizer = useVirtualizer({ count: filter.filteredJobs.length, getScrollElement: () => scrollRef.current, estimateSize: () => isMobile ? ROW_HEIGHT_MOBILE : ROW_HEIGHT_DESKTOP, overscan: VIRTUALIZER_OVERSCAN });
  useSaveToStorage(undo.rankedJobs); useEdgeGlowTimer(nudge.edgeGlow, nudge.setEdgeGlow);
  useEffect(() => { const id = scrollToJobIdRef.current; if (!id) return; scrollToJobIdRef.current = null; const idx = filter.filteredJobs.findIndex((sj) => sj.job.programmeTitle === id); if (idx !== -1) requestAnimationFrame(() => { virtualizer.scrollToIndex(idx, { align: "center", behavior: "smooth" }); }); }, [filter.filteredJobs, virtualizer]);
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); virtualizer.measure(); }, [filter.filters.searchQuery, filter.filters.regionFilter, filter.filters.hospitalFilter, filter.filters.specialtyFilter, isMobile, virtualizer]);
  const collision = useCustomCollision(virtualizer, filter.filteredJobs), getRowData = useRowDataGetter({ filteredJobs: filter.filteredJobs, indexById, nudgeAnim: nudge, bulk });
  const nRefs = { scrollRef, contentRef, isMobile }, handleBoost = useCallback((jobId: string) => nudge.handleNudge({ jobId, direction: "up", rankedJobs: undo.rankedJobs, nudgeAmount, lockedJobIds: bulk.lockedJobIds, pushAndSetRanked: undo.pushAndSetRanked, refs: nRefs }), [nudge.handleNudge, undo.rankedJobs, nudgeAmount, bulk.lockedJobIds, undo.pushAndSetRanked, isMobile]);
  const handleBury = useCallback((jobId: string) => nudge.handleNudge({ jobId, direction: "down", rankedJobs: undo.rankedJobs, nudgeAmount, lockedJobIds: bulk.lockedJobIds, pushAndSetRanked: undo.pushAndSetRanked, refs: nRefs }), [nudge.handleNudge, undo.rankedJobs, nudgeAmount, bulk.lockedJobIds, undo.pushAndSetRanked, isMobile]);
  const handleScroll = useCallback(() => { const el = scrollRef.current; if (!el) return; ui.setScrollDir(el.scrollTop > ui.lastScrollTop.current ? "down" : "up"); ui.lastScrollTop.current = el.scrollTop; ui.setMobileFiltersOpen(false); }, [ui.setScrollDir, ui.setMobileFiltersOpen]);
  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; try { const jobs = await importRankingsFromXlsx(file); undo.setRankedJobs(jobs); } catch (err) { alert(err instanceof ImportError ? err.message : "Failed to read the file."); } finally { if (importFileRef.current) importFileRef.current.value = ""; } }, [undo.setRankedJobs]);
  const openMoveTo = useCallback((id: string, rank: number) => ui.setMoveToState({ jobId: id, rank }), [ui.setMoveToState]), onDragStart = useCallback((e: DragStartEvent) => ui.setActiveId(e.active.id as string), [ui.setActiveId]);
  const onDragEnd = useCallback((e: DragEndEvent) => { ui.setActiveId(null); dndDragEnd({ event: e, lockedJobIds: bulk.lockedJobIds, setActiveId: ui.setActiveId, pushAndSetRanked: undo.pushAndSetRanked }); }, [bulk.lockedJobIds, ui.setActiveId, undo.pushAndSetRanked]), onDragCancel = useCallback(() => ui.setActiveId(null), [ui.setActiveId]);
  const ghostComplete = useCallback((id: string) => { nudge.setGhosts((prev) => { const n = new Map(prev); n.delete(id); return n; }); nudge.applyPendingSort(); }, [nudge.setGhosts, nudge.applyPendingSort]);
  const activeScored = ui.activeId ? undo.rankedJobs.find((j) => j.job.programmeTitle === ui.activeId) ?? null : null, activeScoredRank = ui.activeId ? (indexById.get(ui.activeId) ?? 0) + 1 : 0;
  const cbs = { onSelectDetail: ui.setSelectedDetail, onToggleSelect: bulk.toggleSelect, onTogglePin: bulk.togglePin, onToggleLock: bulk.toggleLock, onBoost: handleBoost, onBury: handleBury, onMoveToOpen: openMoveTo };
  const tbProps = { filteredCount: filter.filteredJobs.length, totalCount: undo.rankedJobs.length, filters: filter.filters, filterActions: filter.filterActions, hasActiveFilters: filter.hasActiveFilters, allRegions: filter.allRegions, allHospitals: filter.allHospitals, allSpecialties: filter.allSpecialties, compareCount: bulk.compareJobs.length, onShowCompare: () => bulk.setShowCompare(true), onExport: () => exportRankingsToXlsx(undo.rankedJobs), onImportClick: () => importFileRef.current?.click(), onUndo: undo.handleUndo, onRedo: undo.handleRedo, canUndo: undo.canUndo, canRedo: undo.canRedo, onShowHelp: () => ui.setShowHelp(true) };
  const bulkNudgeArgs = { rankedJobs: undo.rankedJobs, nudgeAmount, pushAndSetRanked: undo.pushAndSetRanked, rankDeltaRef: nudge.rankDeltaRef, setFlashMap: nudge.setFlashMap };
  return (
    <div className="h-screen flex flex-col bg-background">
      <WelcomeModal externalOpen={ui.showHelp} onExternalClose={() => ui.setShowHelp(false)} /><SiteHeader />
      <DesktopToolbar {...tbProps} /><MobileToolbar {...tbProps} mobileSearchOpen={ui.mobileSearchOpen} setMobileSearchOpen={ui.setMobileSearchOpen} mobileFiltersOpen={ui.mobileFiltersOpen} setMobileFiltersOpen={ui.setMobileFiltersOpen} />
      {bulk.showCompare && <CompareModal jobs={bulk.compareJobs} onClose={() => bulk.setShowCompare(false)} onClear={() => { bulk.setCompareJobs([]); bulk.setShowCompare(false); }} />}
      <input ref={importFileRef} type="file" accept=".xlsx" onChange={handleImportFile} className="hidden" id="import-rankings" />
      <MoveToDialog open={ui.moveToState !== null} onOpenChange={(open) => { if (!open) ui.setMoveToState(null); }} currentRank={ui.moveToState?.rank ?? 1} totalJobs={undo.rankedJobs.length} onMoveTo={(target) => { if (ui.moveToState) bulk.handleMoveTo({ jobId: ui.moveToState.jobId, targetRank: target, pushAndSetRanked: undo.pushAndSetRanked, scrollToJobIdRef }); }} />
      <MoveToDialog open={ui.bulkMoveToOpen} onOpenChange={ui.setBulkMoveToOpen} currentRank={1} totalJobs={undo.rankedJobs.length} onMoveTo={(target) => { bulk.handleBulkMoveTo({ targetRank: target, pushAndSetRanked: undo.pushAndSetRanked }); ui.setBulkMoveToOpen(false); }} />
      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel} autoScroll={{ threshold: { x: 0, y: 0.2 }, acceleration: 15 }}>
        <div className="flex-1 flex overflow-hidden">
          <SortableContext items={filteredIds} strategy={verticalListSortingStrategy}>
            <div ref={contentRef} className="flex-1 flex flex-col overflow-hidden relative">
              <EdgeGlowBar edgeGlow={nudge.edgeGlow} onEnd={() => nudge.setEdgeGlow(null)} />
              {pinnedRowIndices.length > 0 && ui.scrollDir === "down" && <PinnedRows position="top" pinnedRowIndices={pinnedRowIndices} getRowData={getRowData} isMobile={isMobile} {...cbs} />}
              <div ref={scrollRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}><ColumnHeader /><VirtualList virtualizer={virtualizer} filteredJobs={filter.filteredJobs} rankedJobsLength={undo.rankedJobs.length} getRowData={getRowData} onClearFilters={filter.filterActions.clearFilters} isMobile={isMobile} {...cbs} /></div>
              {pinnedRowIndices.length > 0 && ui.scrollDir === "up" && <PinnedRows position="bottom" pinnedRowIndices={pinnedRowIndices} getRowData={getRowData} isMobile={isMobile} {...cbs} />}
              <CascadeGhostOverlay cascadeGhosts={nudge.cascadeGhosts} isMobile={isMobile} />
            </div>
          </SortableContext>
          {bulk.selectedIds.size >= 1 && <SelectionToolbar count={bulk.selectedIds.size} selectedJobs={undo.rankedJobs.filter((sj) => bulk.selectedIds.has(sj.job.programmeTitle))} onClear={bulk.clearSelection} onCompare={() => bulk.handleBulkCompare(undo.rankedJobs)} onMoveTo={() => ui.setBulkMoveToOpen(true)} onBoostAll={() => bulk.handleBulkBoost(bulkNudgeArgs)} onBuryAll={() => bulk.handleBulkBury(bulkNudgeArgs)} />}
        </div>
        <DragOverlay>{activeScored ? <ListDragOverlayRow scored={activeScored} rank={activeScoredRank} isMobile={isMobile} /> : null}</DragOverlay>
      </DndContext>
      <GhostOverlay ghosts={nudge.ghosts} isMobile={isMobile} onAnimationComplete={ghostComplete} /><AnimatePresence>{ui.selectedDetail && <JobDetailPanel key={ui.selectedDetail.programmeTitle} job={ui.selectedDetail} onClose={() => ui.setSelectedDetail(null)} isMobile={isMobile} />}</AnimatePresence>
    </div>
  );
}
