import React from "react";
import { Copy, ChevronUp, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Types - importados do editor principal
type Locale = "en-US" | "pt-BR" | "de" | "ja" | "zh-CN" | string;
type LabelString = string & { __brand_label100?: true };
type LabelLocalization = { default: LabelString } & Partial<Record<Locale, LabelString>>;

interface BaseStat {
  id: number;
  type: string;
  name: LabelLocalization;
  emoji?: string;
}

// Definindo os types de Stats necessários
type Stats = BaseStat & (
  | { type: "numeric"; min?: number; max?: number }
  | { type: "enum"; options: number | any[] }
  | { type: "boolean" }
  | { type: "string"; minLength?: number; maxLength?: number }
  | { type: "calculated"; formula: string }
);

interface Section {
  id: number;
  name: LabelLocalization;
  quick_edit_btn: boolean;
  preview: any;
  view_pages: number[];
}

interface StatsTabProps {
  stats: Stats[];
  sections: Section[];
  onAddStat: (kind: Stats["type"]) => void;
  onUpdateStat: (index: number, value: Stats) => void;
  onRemoveStat: (index: number) => void;
  onDuplicateStat: (index: number) => void;
  onMoveStat: (index: number, dir: -1 | 1) => void;
  // Componente auxiliar passado como prop
  PolymorphicStatEditor: React.ComponentType<{
    value: Stats;
    onChange: (v: Stats) => void;
    sections: Section[];
    allStats: Stats[];
  }>;
}

const StatsTab: React.FC<StatsTabProps> = ({
  stats,
  sections,
  onAddStat,
  onUpdateStat,
  onRemoveStat,
  onDuplicateStat,
  onMoveStat,
  PolymorphicStatEditor,
}) => {
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        <Button size="sm" variant="secondary" onClick={() => onAddStat("numeric")}>
          + Numeric
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onAddStat("enum")}>
          + Enum
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onAddStat("boolean")}>
          + Boolean
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onAddStat("string")}>
          + String
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onAddStat("calculated")}>
          + Calculated
        </Button>
      </div>
      <div className="grid gap-4">
        {stats.map((st, i) => (
          <Card key={i} className="relative">
            <div className="flex items-center justify-end gap-1 absolute top-2 right-2 z-10">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onDuplicateStat(i)}
                title="Duplicar stat"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onMoveStat(i, -1)}
                title="Mover para cima"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onMoveStat(i, +1)}
                title="Mover para baixo"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onRemoveStat(i)}
                title="Remover stat"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="w-full text-left">
                <CardHeader className="py-3 pr-32">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge variant="secondary">{st.type}</Badge>
                    <span>{st.name?.default || `Stat ${i + 1}`}</span>
                    <ChevronRight className="h-4 w-4 transition-transform duration-200 ui-state-open:rotate-90" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <PolymorphicStatEditor
                    value={st}
                    onChange={(v) => onUpdateStat(i, v)}
                    sections={sections}
                    allStats={stats}
                  />
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>
    </>
  );
};

export default StatsTab;