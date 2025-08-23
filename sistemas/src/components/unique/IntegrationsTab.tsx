import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Types - importados do editor principal
type Locale = "en-US" | "pt-BR" | "de" | "ja" | "zh-CN" | string;
type Localization<T = string> = { default: T } & Partial<Record<Locale, T>>;
type LabelString = string & { __brand_label100?: true };
type LabelLocalization = { default: LabelString } & Partial<Record<Locale, LabelString>>;

interface BaseStat {
  id: number;
  name: LabelLocalization;
  edit_page?: number[];
  emoji?: string;
}

type Stats = BaseStat & (
  | { type: "numeric"; min?: number; max?: number }
  | { type: "enum"; options: number | any[] }
  | { type: "boolean" }
  | { type: "string"; minLength?: number; maxLength?: number }
  | { type: "calculated"; formula: string }
);

interface SchemaOption {
  value: string;
  label: LabelString;
}

interface SchemaEval {
  name: LabelString;
  type: "eval";
  options: SchemaOption[];
}

interface NexusSchemas {
  id: number;
  name: LabelLocalization;
  description: Localization<string>;
  fields?: {
    [key: number]: SchemaEval;
  };
  AutorizedModifierList: any[];
  authorized_status_ids: number[];
}

interface Integrations {
  iniciative?: {
    id: string;
  };
  atributes_roll?: string;
  schemas: NexusSchemas[];
}

interface IntegrationsTabProps {
  integrations?: Integrations;
  stats: Stats[];
  onUpdateIntegrations: (integrations: Integrations) => void;
  // Componentes auxiliares para localização
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
  // Editores de expressão para atributos de rolagem
  MathExpressionEditor?: React.ComponentType<{
    value: string;
    onChange: (value: string) => void;
    stats?: any[];
    onConfirm?: (expression: string) => void;
  }>;
  DiceNotationEditor?: React.ComponentType<{
    value: string;
    onChange: (value: string) => void;
    stats?: any[];
    onConfirm?: (expression: string) => void;
  }>;
}

const IntegrationsTab: React.FC<IntegrationsTabProps> = ({
  integrations,
  stats,
  onUpdateIntegrations,
  LabelLocalizationEditor,
  CompactTextLocalizationEditor,
  MathExpressionEditor,
  DiceNotationEditor,
}) => {
  const [newFieldKey, setNewFieldKey] = useState<number>(1);
  const [showExpressionEditor, setShowExpressionEditor] = useState<"math" | "dice" | null>(null);
  const [tempExpression, setTempExpression] = useState<string>("");

  const currentIntegrations: Integrations = integrations || {
    schemas: [],
  };

  const updateIntegrations = (updates: Partial<Integrations>) => {
    onUpdateIntegrations({ ...currentIntegrations, ...updates });
  };

  const addSchema = () => {
    const newId = currentIntegrations.schemas.length; // ID incremental automático
    const newSchema: NexusSchemas = {
      id: newId,
      name: { default: `Schema ${newId}` },
      description: { default: "Descrição do schema" },
      fields: {},
      AutorizedModifierList: [],
      authorized_status_ids: []
    };
    updateIntegrations({
      schemas: [...currentIntegrations.schemas, newSchema],
    });
  };

  const updateSchema = (index: number, updates: Partial<NexusSchemas>) => {
    const schemas = [...currentIntegrations.schemas];
    schemas[index] = { ...schemas[index], ...updates };
    updateIntegrations({ schemas });
  };

  const removeSchema = (index: number) => {
    const schemas = currentIntegrations.schemas.filter((_, i) => i !== index);
    updateIntegrations({ schemas });
  };

  const addField = (schemaIndex: number) => {
    const schema = currentIntegrations.schemas[schemaIndex];
    const newField: SchemaEval = {
      name: "novo_campo" as LabelString,
      type: "eval",
      options: [],
    };
    
    const fields = { ...schema.fields };
    fields[newFieldKey] = newField;
    
    updateSchema(schemaIndex, { fields });
    setNewFieldKey(newFieldKey + 1);
  };

  const updateField = (schemaIndex: number, fieldKey: number, updates: Partial<SchemaEval>) => {
    const schema = currentIntegrations.schemas[schemaIndex];
    const fields = { ...schema.fields };
    fields[fieldKey] = { ...fields[fieldKey], ...updates };
    updateSchema(schemaIndex, { fields });
  };

  const removeField = (schemaIndex: number, fieldKey: number) => {
    const schema = currentIntegrations.schemas[schemaIndex];
    const fields = { ...schema.fields };
    delete fields[fieldKey];
    updateSchema(schemaIndex, { fields });
  };

  const addOption = (schemaIndex: number, fieldKey: number) => {
    const schema = currentIntegrations.schemas[schemaIndex];
    const field = schema.fields?.[fieldKey];
    if (field) {
      const newOption: SchemaOption = {
        value: "",
        label: "Nova Opção" as LabelString,
      };
      updateField(schemaIndex, fieldKey, {
        options: [...field.options, newOption],
      });
    }
  };

  const updateOption = (schemaIndex: number, fieldKey: number, optionIndex: number, updates: Partial<SchemaOption>) => {
    const schema = currentIntegrations.schemas[schemaIndex];
    const field = schema.fields?.[fieldKey];
    if (field) {
      const options = [...field.options];
      options[optionIndex] = { ...options[optionIndex], ...updates };
      updateField(schemaIndex, fieldKey, { options });
    }
  };

  const removeOption = (schemaIndex: number, fieldKey: number, optionIndex: number) => {
    const schema = currentIntegrations.schemas[schemaIndex];
    const field = schema.fields?.[fieldKey];
    if (field) {
      const options = field.options.filter((_, i) => i !== optionIndex);
      updateField(schemaIndex, fieldKey, { options });
    }
  };

  const addAuthorizedStatusId = (schemaIndex: number, statusId: number) => {
    const schema = currentIntegrations.schemas[schemaIndex];
    if (!schema.authorized_status_ids.includes(statusId)) {
      updateSchema(schemaIndex, {
        authorized_status_ids: [...schema.authorized_status_ids, statusId],
      });
    }
  };

  const removeAuthorizedStatusId = (schemaIndex: number, statusId: number) => {
    const schema = currentIntegrations.schemas[schemaIndex];
    updateSchema(schemaIndex, {
      authorized_status_ids: schema.authorized_status_ids.filter(id => id !== statusId),
    });
  };

  const openExpressionEditor = (type: "math" | "dice") => {
    setTempExpression(currentIntegrations.atributes_roll || "");
    setShowExpressionEditor(type);
  };

  const confirmExpression = (expression: string) => {
    updateIntegrations({ atributes_roll: expression });
    setShowExpressionEditor(null);
    setTempExpression("");
  };

  // Filtrar stats que têm dados (dices) configurados
  const getStatsWithDices = () => {
    return stats.filter(stat => {
      // Verificar se o stat tem dices configurados
      if ('dices' in stat && Array.isArray(stat.dices) && stat.dices.length > 0) {
        return true;
      }
      return false;
    });
  };

  const statsWithDices = getStatsWithDices();

  return (
    <div className="grid gap-6">
      {/* Configurações Gerais */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Integração</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>Stat de Iniciativa</Label>
            {statsWithDices.length === 0 ? (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md text-center">
                📭 Nenhum stat com dados configurados.
                <br />
                <span className="text-xs">Configure dados (dices) em pelo menos um stat para poder usá-lo como iniciativa.</span>
              </div>
            ) : (
              <>
                <Select
                  value={currentIntegrations.iniciative?.id || ""}
                  onValueChange={(value) =>
                    updateIntegrations({
                      iniciative: { id: value },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um stat com dados configurados" />
                  </SelectTrigger>
                  <SelectContent>
                    {statsWithDices.map((stat) => (
                      <SelectItem key={stat.id} value={String(stat.id)}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {stat.type}
                          </Badge>
                          <span>
                            {stat.emoji && `${stat.emoji} `}
                            {stat.name?.default || `Stat ${stat.id}`}
                          </span>
                          <code className="text-xs bg-muted px-1 rounded">
                            ID: {stat.id}
                          </code>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentIntegrations.iniciative?.id && (
                  <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    <strong>Selecionado:</strong> {(() => {
                      const selectedStat = statsWithDices.find(s => s.id === parseInt(currentIntegrations.iniciative?.id || ""));
                      if (selectedStat) {
                        const dicesCount = 'dices' in selectedStat && Array.isArray(selectedStat.dices) ? selectedStat.dices.length : 0;
                        return `${selectedStat.name?.default || `Stat ${selectedStat.id}`} com ${dicesCount} dado(s) configurado(s)`;
                      }
                      return "Stat não encontrado";
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
          
          <div className="grid gap-2">
            <Label>Atributos de Rolagem</Label>
            <div className="flex gap-2">
              <Textarea
                value={currentIntegrations.atributes_roll || ""}
                onChange={(e) =>
                  updateIntegrations({
                    atributes_roll: e.target.value,
                  })
                }
                placeholder="Configuração dos atributos de rolagem"
                rows={3}
                className="flex-1"
              />
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openExpressionEditor("math")}
                  title="Editor de Expressão Matemática"
                >
                  Math
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openExpressionEditor("dice")}
                  title="Editor de Dice Notation"
                >
                  Dice
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schemas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Nexus Schemas</CardTitle>
          <Button onClick={addSchema} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Schema
          </Button>
        </CardHeader>
        <CardContent>
          {currentIntegrations.schemas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <div className="text-2xl mb-2">🔗</div>
              <p className="text-sm">Nenhum schema configurado.</p>
              <p className="text-xs">Adicione schemas para configurar integrações.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {currentIntegrations.schemas.map((schema, schemaIndex) => (
                <Card key={schema.id} className="border-dashed">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Schema {schema.id}</Badge>
                        <span className="font-medium">{schema.name.default}</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeSchema(schemaIndex)}
                        title="Remover schema"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <LabelLocalizationEditor
                      label="Nome do Schema"
                      value={schema.name}
                      onChange={(v) => updateSchema(schemaIndex, { name: v })}
                    />
                    
                    <CompactTextLocalizationEditor
                      label="Descrição"
                      value={schema.description}
                      onChange={(v) => updateSchema(schemaIndex, { description: v })}
                      placeholder="Descrição do schema"
                    />

                    {/* Authorized Status IDs (Stats) */}
                    <div className="grid gap-2">
                      <Label>Stats Autorizados</Label>
                      <div className="border rounded-md p-3 bg-muted/20">
                        <div className="grid gap-2 max-h-32 overflow-y-auto">
                          {stats.map((stat) => (
                            <label key={stat.id} className="flex items-center space-x-2 text-sm">
                              <Checkbox
                                checked={schema.authorized_status_ids.includes(stat.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    addAuthorizedStatusId(schemaIndex, stat.id);
                                  } else {
                                    removeAuthorizedStatusId(schemaIndex, stat.id);
                                  }
                                }}
                              />
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {stat.type}
                                </Badge>
                                <span>
                                  {stat.emoji && `${stat.emoji} `}
                                  {stat.name?.default || `Stat ${stat.id}`}
                                </span>
                                <code className="text-xs bg-muted px-1 rounded">
                                  ID: {stat.id}
                                </code>
                              </div>
                            </label>
                          ))}
                        </div>
                        {stats.length === 0 && (
                          <p className="text-muted-foreground text-xs text-center py-2">
                            Nenhum stat disponível no sistema
                          </p>
                        )}
                        {schema.authorized_status_ids.length > 0 && (
                          <div className="mt-2 pt-2 border-t">
                            <p className="text-xs text-muted-foreground mb-1">
                              Selecionados: {schema.authorized_status_ids.length} stats
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {schema.authorized_status_ids.map((id) => {
                                const stat = stats.find(s => s.id === id);
                                return (
                                  <Badge key={id} variant="secondary" className="text-xs">
                                    {stat?.name?.default || `ID ${id}`}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Fields */}
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <Label>Campos do Schema</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addField(schemaIndex)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Campo
                        </Button>
                      </div>
                      
                      {schema.fields && Object.keys(schema.fields).length > 0 ? (
                        <div className="grid gap-3">
                          {Object.entries(schema.fields).map(([fieldKey, field]) => (
                            <Card key={fieldKey} className="border-muted">
                              <CardHeader className="py-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      Campo {fieldKey}
                                    </Badge>
                                    <code className="text-xs bg-muted px-2 py-1 rounded">
                                      {field.name}
                                    </code>
                                  </div>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => removeField(schemaIndex, Number(fieldKey))}
                                    className="h-6 w-6"
                                    title="Remover campo"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent className="py-2 grid gap-3">
                                <div className="grid gap-2">
                                  <Label className="text-xs">Nome do Campo</Label>
                                  <Input
                                    value={field.name}
                                    onChange={(e) =>
                                      updateField(schemaIndex, Number(fieldKey), {
                                        name: e.target.value as LabelString,
                                      })
                                    }
                                    className="text-xs"
                                  />
                                </div>

                                {/* Options */}
                                <div className="grid gap-2">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-xs">Opções</Label>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => addOption(schemaIndex, Number(fieldKey))}
                                      className="h-6 text-xs"
                                    >
                                      + Opção
                                    </Button>
                                  </div>
                                  
                                  {field.options.map((option, optionIndex) => (
                                    <div key={optionIndex} className="flex items-center gap-2">
                                      <Input
                                        value={option.value}
                                        onChange={(e) =>
                                          updateOption(schemaIndex, Number(fieldKey), optionIndex, {
                                            value: e.target.value,
                                          })
                                        }
                                        placeholder="Valor"
                                        className="text-xs flex-1"
                                      />
                                      <Input
                                        value={option.label}
                                        onChange={(e) =>
                                          updateOption(schemaIndex, Number(fieldKey), optionIndex, {
                                            label: e.target.value as LabelString,
                                          })
                                        }
                                        placeholder="Label"
                                        className="text-xs flex-1"
                                      />
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() =>
                                          removeOption(schemaIndex, Number(fieldKey), optionIndex)
                                        }
                                        className="h-6 w-6"
                                        title="Remover opção"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground border border-dashed rounded">
                          <p className="text-xs">Nenhum campo configurado</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs para editores de expressão */}
      {showExpressionEditor === "math" && MathExpressionEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Editor de Expressão Matemática</h3>
              <Button variant="ghost" onClick={() => setShowExpressionEditor(null)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <MathExpressionEditor
              value={tempExpression}
              onChange={setTempExpression}
              onConfirm={confirmExpression}
            />
          </div>
        </div>
      )}

      {showExpressionEditor === "dice" && DiceNotationEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Editor de Dice Notation</h3>
              <Button variant="ghost" onClick={() => setShowExpressionEditor(null)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <DiceNotationEditor
              value={tempExpression}
              onChange={setTempExpression}
              onConfirm={confirmExpression}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrationsTab;