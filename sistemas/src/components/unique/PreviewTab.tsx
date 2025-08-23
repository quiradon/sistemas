import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Types - importados do editor principal
type Locale = "en-US" | "pt-BR" | "de" | "ja" | "zh-CN" | string;
type Localization<T = string> = { default: T } & Partial<Record<Locale, T>>;
type LabelString = string & { __brand_label100?: true };
type LabelLocalization = { default: LabelString } & Partial<Record<Locale, LabelString>>;

interface RPGSystemConfig {
  id: number;
  name: LabelLocalization;
  description: Localization<string>;
}

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

interface Integrations {
  iniciative?: {
    id: string;
  };
  atributes_roll?: string;
  schemas: any[]; // Simplificado para evitar dependências complexas
}

interface RPGSystem {
  config: RPGSystemConfig;
  stats: Stats[];
  sections: Section[];
  integrations?: Integrations;
}

interface PreviewTabProps {
  system: RPGSystem;
}

const PreviewTab: React.FC<PreviewTabProps> = ({ system }) => {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">JSON</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="text-xs overflow-auto bg-muted p-3 rounded-xl max-h-[60vh]">
          {JSON.stringify(system, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
};

export default PreviewTab;