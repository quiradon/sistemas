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

interface ConfigTabProps {
  value: RPGSystemConfig;
  onChange: (value: RPGSystemConfig) => void;
  // Componentes auxiliares passados como props para evitar duplicação
  LabelLocalizationEditor: React.ComponentType<{
    label: string;
    value: LabelLocalization;
    onChange: (v: LabelLocalization) => void;
  }>;
  CompactTextLocalizationEditor: React.ComponentType<{
    label: string;
    value: Localization<string>;
    onChange: (v: Localization<string>) => void;
    placeholder?: string;
  }>;
}

const ConfigTab: React.FC<ConfigTabProps> = ({
  value,
  onChange,
  LabelLocalizationEditor,
  CompactTextLocalizationEditor,
}) => {
  const patch = (p: Partial<RPGSystemConfig>) => onChange({ ...value, ...p });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração do Sistema</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <LabelLocalizationEditor
          label="Nome (localizado)"
          value={value.name}
          onChange={(v) => patch({ name: v })}
        />
        <CompactTextLocalizationEditor
          label="Descrição"
          value={value.description}
          onChange={(v) => patch({ description: v })}
          placeholder="Breve resumo do sistema"
        />
      </CardContent>
    </Card>
  );
};

export default ConfigTab;