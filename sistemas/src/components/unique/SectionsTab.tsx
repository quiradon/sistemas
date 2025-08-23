import React from "react";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

interface SectionsTabProps {
  sections: Section[];
  stats: Stats[];
  onAddSection: () => void;
  onUpdateSection: (index: number, value: Section) => void;
  onRemoveSection: (index: number) => void;
  onMoveSection: (index: number, dir: -1 | 1) => void;
  // Componente auxiliar passado como prop
  SectionEditor: React.ComponentType<{
    value: Section;
    onChange: (v: Section) => void;
    sections: Section[];
    stats: Stats[];
  }>;
}

const SectionsTab: React.FC<SectionsTabProps> = ({
  sections,
  stats,
  onAddSection,
  onUpdateSection,
  onRemoveSection,
  onMoveSection,
  SectionEditor,
}) => {
  return (
    <>
      <div className="mb-3">
        <Button size="sm" variant="secondary" onClick={onAddSection}>
          + Adicionar Seção
        </Button>
      </div>
      <div className="grid gap-4">
        {sections.map((sec, i) => (
          <Card key={i}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant="secondary">Seção</Badge>
                  <span>{sec.name?.default || `Seção ${i + 1}`}</span>
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onMoveSection(i, -1)}
                    title="Mover para cima"
                    disabled={i === 0}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onMoveSection(i, +1)}
                    title="Mover para baixo"
                    disabled={i === sections.length - 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onRemoveSection(i)}
                    title="Remover seção"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <SectionEditor
                value={sec}
                onChange={(v) => onUpdateSection(i, v)}
                sections={sections}
                stats={stats}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
};

export default SectionsTab;