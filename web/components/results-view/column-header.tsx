"use client";

function HeaderCell(props: {
  children: React.ReactNode;
  className?: string;
}): React.ReactNode {
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wider text-muted-foreground ${props.className ?? ""}`}
    >
      {props.children}
    </span>
  );
}

function PlacementHeader(props: {
  label: string;
  year: string;
}): React.ReactNode {
  return (
    <HeaderCell className="pr-1.5">
      {props.label}{" "}
      <span className="font-normal text-muted-foreground">
        ({props.year})
      </span>
    </HeaderCell>
  );
}

export function ColumnHeader(): React.ReactNode {
  return (
    <div
      className="hidden sm:grid items-center gap-x-0.5 h-[32px] border-b-2 border-border bg-secondary/30"
      style={{
        gridTemplateColumns:
          "40px auto minmax(100px,auto) repeat(6, minmax(90px, 1fr)) 90px 140px",
      }}
    >
      <HeaderCell className="text-right pr-2">#</HeaderCell>
      <HeaderCell className="text-center">Region</HeaderCell>
      <HeaderCell className="pr-16">Programme</HeaderCell>
      <PlacementHeader label="P1" year="FY1" />
      <PlacementHeader label="P2" year="FY1" />
      <PlacementHeader label="P3" year="FY1" />
      <PlacementHeader label="P4" year="FY2" />
      <PlacementHeader label="P5" year="FY2" />
      <PlacementHeader label="P6" year="FY2" />
      <HeaderCell className="text-center">Score</HeaderCell>
      <HeaderCell className="text-center">Actions</HeaderCell>
    </div>
  );
}
