import React, { useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Download,
  Upload,
  Copy,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  Heading1,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Code,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import EmojiPickerReact from "emoji-picker-react";
import { evaluate } from "mathjs";
import { DiceRoll } from '@dice-roller/rpg-dice-roller';
import MathExpressionEditor from "@/components/unique/MathExpressionEditor";
import DiceNotationEditor from "@/components/unique/DiceNotationEditor";
import ConfigTab from "@/components/unique/ConfigTab";
import StatsTab from "@/components/unique/StatsTab";
import SectionsTab from "@/components/unique/SectionsTab";
import PreviewTab from "@/components/unique/PreviewTab";
import IntegrationsTab from "@/components/unique/IntegrationsTab";

// =====================
// Types
// =====================
export type Locale = "en-US" | "pt-BR" | "de" | "ja" | "zh-CN" | string;

type Localization<T = string> = { default: T } & Partial<Record<Locale, T>>;

type LabelString = string & { __brand_label100?: true };

export type LabelLocalization = { default: LabelString } & Partial<Record<Locale, LabelString>>;

interface BaseStat {
  id: number;
  name: LabelLocalization;
  edit_page?: number[]; // Seções (por id) onde o stat pode ser editado
  emoji?: string;
}

interface StatsNumeric extends BaseStat { type: "numeric"; min?: number; max?: number; dices?: Dice[]; replacements?: Replacement[]; }
interface StatsEnumOption { value: number; name: LabelLocalization; emoji?: string; }
interface StatsEnum extends BaseStat { type: "enum"; options: StatsEnumOption[] | number; dices?: Dice[]; replacements?: Replacement[]; }
interface StatsBoolean extends BaseStat { type: "boolean"; dices?: Dice[]; replacements?: Replacement[]; }
interface StatsString extends BaseStat { type: "string"; maxLength?: number; minLength?: number; }
interface StatsCalculated extends BaseStat { type: "calculated"; formula: string; dices?: Dice[]; replacements?: Replacement[]; }
interface Replacement { key: number; options: number[]; }

export type Stats = StatsNumeric | StatsEnum | StatsBoolean | StatsString | StatsCalculated;

export interface RPGSystem {
  config: { id: number; name: LabelLocalization; description: Localization<string>; };
  stats: Stats[];
  sections: Section[];
  integrations?: Integrations;
}

interface Section {
  id: number;
  name: LabelLocalization;
  emoji?: string;
  quick_edit_btn: boolean;
  preview: { type: "string" | "img"; content: Localization<string>; };
  view_pages: number[]; // Seções (ids) onde ESTA seção também aparece (para aglomerar com outras páginas)
}

interface Dice { expression: string; condition?: { value1: string; operator: "<"|">"|"<="|">="|"=="|"!="; value2: string; }; }

// =====================
// Integration Types
// =====================
interface Integrations {
  iniciative?: {
    id: string;
  };
  atributes_roll?: string;
  schemas: NexusSchemas[];
  autorized_status_ids?: number[]
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

interface SchemaEval {
  name: LabelString;
  type: "eval";
  options: SchemaOption[];
}

interface SchemaOption {
  value: string;
  label: LabelString;
}

// =====================
// Helpers
// =====================
const emptyLabelLoc = (): LabelLocalization => ({ default: "" });
function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
function download(filename: string, text: string) {
  const element = document.createElement("a");
  const file = new Blob([text], { type: "application/json" });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element); element.click(); element.remove();
}
function nextId(list: { id: number }[]): number { return (list.reduce((m, x) => Math.max(m, x.id), 0) || 0) + 1; }
function allLocalesFrom(value: Localization<string>, base: Locale[]): (Locale | "default")[] {
  const keys = Object.keys(value || {}) as (Locale | "default")[];
  const set = new Set<Locale | "default">(["default", ...base, ...keys.filter((k) => k !== "default")]);
  return Array.from(set);
}

// Função para detectar dependências recursivas entre stats calculated
function findStatDependencies(formula: string): number[] {
  const regex = /<stat:(\d+):value>/g;
  const dependencies: number[] = [];
  let match;
  
  while ((match = regex.exec(formula)) !== null) {
    const statId = parseInt(match[1]);
    if (!dependencies.includes(statId)) {
      dependencies.push(statId);
    }
  }
  
  return dependencies;
}

function hasCircularDependency(
  currentStatId: number, 
  formula: string, 
  allStats: Stats[]
): boolean {
  const visited = new Set<number>();
  
  function checkRecursive(statId: number, currentFormula: string): boolean {
    if (visited.has(statId)) {
      return true; // Ciclo detectado
    }
    
    visited.add(statId);
    const dependencies = findStatDependencies(currentFormula);
    
    for (const depId of dependencies) {
      if (depId === currentStatId) {
        return true; // Referência circular direta
      }
      
      const depStat = allStats.find(s => s.id === depId);
      if (depStat && depStat.type === 'calculated') {
        if (checkRecursive(depId, depStat.formula)) {
          return true;
        }
      }
    }
    
    visited.delete(statId);
    return false;
  }
  
  return checkRecursive(currentStatId, formula);
}

// =====================
// Smart Preview Components
// =====================
const SmartPreview = ({ value, sections = [], stats = [], locale = 'default' }: {
  value: string;
  sections?: Section[];
  stats?: Stats[];
  locale?: string;
}) => {
  // Função para resolver valor real de uma variável
  const resolveVariableValue = (type: string, id: string, property: string): string => {
    const numId = parseInt(id);
    
    if (type === 'stat') {
      const stat = stats.find(s => s.id === numId);
      if (!stat) return `[Stat ${id} não encontrado]`;
      
      switch (property) {
        case 'name':
          return stat.name?.[locale] || stat.name?.default || `Stat ${id}`;
        case 'emoji':
          return stat.emoji || '';
        case 'value':
          switch (stat.type) {
            case 'numeric':
              return String(stat.min || 1);
            case 'string':
              return 'string';
            case 'boolean':
              return 'false';
            case 'enum':
              if (Array.isArray(stat.options) && stat.options.length > 0) {
                const firstOption = stat.options[0];
                return firstOption.name?.[locale] || firstOption.name?.default || 'Option 1';
              } else if (typeof stat.options === 'number' && stat.options > 0) {
                // Está referenciando outro enum
                const referencedStat = stats.find(s => s.id === stat.options) as StatsEnum | undefined;
                if (referencedStat && Array.isArray(referencedStat.options) && referencedStat.options.length > 0) {
                  const firstOption = referencedStat.options[0];
                  return firstOption.name?.[locale] || firstOption.name?.default || 'Option 1';
                }
                return `[ref: ${stat.options}]`;
              }
              return 'enum';
            case 'calculated':
              return '[calculado]';
            default:
              return 'valor';
          }
        default:
          return `[propriedade ${property} desconhecida]`;
      }
    } else if (type === 'section') {
      const section = sections.find(s => s.id === numId);
      if (!section) return `[Seção ${id} não encontrada]`;
      
      switch (property) {
        case 'name':
          return section.name?.[locale] || section.name?.default || `Seção ${id}`;
        case 'emoji':
          return section.emoji || '';
        default:
          return `[propriedade ${property} desconhecida]`;
      }
    }
    
    return `[tipo ${type} desconhecido]`;
  };

  // Função para avaliar expressões matemáticas
  const evaluateMathExpression = (expression: string): string => {
    try {
      // Substituir variáveis na expressão por seus valores numéricos
      const processedExpression = expression.replace(/<(stat):(\d+):(value)>/g, (_, __, id) => {
        const numId = parseInt(id);
        const stat = stats.find(s => s.id === numId);
        
        if (!stat) return '0';
        
        // Só incluir stats que podem ter valores numéricos
        switch (stat.type) {
          case 'numeric':
            return String(stat.min || 1);
          case 'boolean':
            return '0'; // false = 0, true = 1
          case 'enum':
            if (Array.isArray(stat.options) && stat.options.length > 0) {
              return String(stat.options[0].value);
            } else if (typeof stat.options === 'number' && stat.options > 0) {
              const referencedStat = stats.find(s => s.id === stat.options) as StatsEnum | undefined;
              if (referencedStat && Array.isArray(referencedStat.options) && referencedStat.options.length > 0) {
                return String(referencedStat.options[0].value);
              }
            }
            return '1';
          case 'calculated':
            return '0'; // Valor placeholder para calculados
          default:
            return '0';
        }
      });

      // Avaliar a expressão usando math.js
      const result = evaluate(processedExpression);
      // Garantir que o resultado seja sempre uma string
      return typeof result === 'object' ? JSON.stringify(result) : String(result);
    } catch (error) {
      return `[Erro: ${expression}]`;
    }
  };

  // Função para avaliar dados (dice notation)
  const evaluateDiceExpression = (expression: string): string => {
    try {
      // Substituir variáveis na expressão por seus valores numéricos (mesma lógica do math)
      const processedExpression = expression.replace(/<(stat):(\d+):(value)>/g, (_, __, id) => {
        const numId = parseInt(id);
        const stat = stats.find(s => s.id === numId);
        
        if (!stat) return '3';
        
        switch (stat.type) {
          case 'numeric':
            return String(stat.min || 3);
          case 'boolean':
            return '1';
          case 'enum':
            if (Array.isArray(stat.options) && stat.options.length > 0) {
              return String(stat.options[0].value);
            } else if (typeof stat.options === 'number' && stat.options > 0) {
              const referencedStat = stats.find(s => s.id === stat.options) as StatsEnum | undefined;
              if (referencedStat && Array.isArray(referencedStat.options) && referencedStat.options.length > 0) {
                return String(referencedStat.options[0].value);
              }
            }
            return '2';
          case 'calculated':
            return '3';
          default:
            return '3';
        }
      });

      // Usar a biblioteca de dados para rolar
      const roll = new DiceRoll(processedExpression);
      return `🎲 ${roll.output}`;
    } catch (error) {
      return `[Erro dados: ${error instanceof Error ? error.message : expression}]`;
    }
  };

  // Processar variáveis para valores reais
  let processedValue = value.replace(/<(stat|section):(\d+):(name|value|emoji)>/g, (_, type, id, property) => {
    return resolveVariableValue(type, id, property);
  });

  // Processar variáveis matemáticas
  processedValue = processedValue.replace(/<math:([^>]+)>/g, (_, expression) => {
    return evaluateMathExpression(expression);
  });

  // Processar dados (dice notation)
  processedValue = processedValue.replace(/<dice:([^>]+)>/g, (_, expression) => {
    return evaluateDiceExpression(expression);
  });

  // Converter quebras de linha simples em quebras de linha Markdown (duas quebras)
  // Isso preserva quebras de linha no preview sem quebrar a formatação Markdown
  processedValue = processedValue.replace(/\n/g, '  \n');

  // Componentes customizados para markdown
  const components = {
    h1: ({ children }: any) => <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0 border-b pb-2">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-xl font-semibold mb-3 mt-5 first:mt-0">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-lg font-medium mb-2 mt-4 first:mt-0">{children}</h3>,
    h4: ({ children }: any) => <h4 className="text-base font-medium mb-2 mt-3 first:mt-0">{children}</h4>,
    h5: ({ children }: any) => <h5 className="text-sm font-medium mb-1 mt-2 first:mt-0">{children}</h5>,
    h6: ({ children }: any) => <h6 className="text-xs font-medium mb-1 mt-2 first:mt-0">{children}</h6>,
    p: ({ children }: any) => <p className="mb-3 last:mb-0">{children}</p>,
    ul: ({ children }: any) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
    li: ({ children }: any) => <li className="pl-2">{children}</li>,
    blockquote: ({ children }: any) => <blockquote className="border-l-4 border-muted pl-4 italic my-3">{children}</blockquote>,
    code: ({ children, inline }: any) => inline ? 
      <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">{children}</code> :
      <code className="block bg-muted p-3 rounded-md text-sm font-mono whitespace-pre-wrap">{children}</code>,
    pre: ({ children }: any) => <pre className="bg-muted p-3 rounded-md text-sm font-mono whitespace-pre-wrap overflow-x-auto mb-3">{children}</pre>,
    a: ({ href, children }: any) => <a href={href} className="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer">{children}</a>,
  };

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {processedValue?.trim() ? (
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={components}
        >
          {processedValue}
        </ReactMarkdown>
      ) : (
        <p className="text-muted-foreground">Nada para pré-visualizar.</p>
      )}
    </div>
  );
};

// =====================
// Markdown Editor
// =====================
function useInsertAtCursor(textarea: HTMLTextAreaElement | null) {
  return (before: string, after: string = "", placeholder = "") => {
    if (!textarea) return; const start = textarea.selectionStart ?? 0; const end = textarea.selectionEnd ?? 0;
    const value = textarea.value; const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    textarea.value = next; const caret = start + before.length + selected.length;
    textarea.setSelectionRange(caret, caret); textarea.dispatchEvent(new Event("input", { bubbles: true })); textarea.focus();
  };
}
function ToolbarButton({ onClick, children, title }: { onClick: () => void; children: React.ReactNode; title: string }) {
  return (<Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClick} title={title}>{children}</Button>);
}
function MarkdownEditor({ value, onChange, placeholder, sections = [], stats = [], locale = 'default' }: { 
  value: string; 
  onChange: (v: string) => void; 
  placeholder?: string;
  sections?: Section[];
  stats?: Stats[];
  locale?: string;
}) {
  const [tab, setTab] = useState<"write" | "preview" | "split">("write");
  const [showVariables, setShowVariables] = useState(false);
  const [showMathEditor, setShowMathEditor] = useState(false);
  const [showDiceEditor, setShowDiceEditor] = useState(false);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [variableFilter, setVariableFilter] = useState("");
  const [mathExpression, setMathExpression] = useState("");
  const [diceExpression, setDiceExpression] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const insert = useInsertAtCursor(ref.current);

  // Estrutura hierárquica do menu
  const menuStructure = useMemo(() => {
    const structure: any = {
      stats: {
        label: "Stats",
        icon: "📊",
        children: {}
      },
      sections: {
        label: "Seções", 
        icon: "📄",
        children: {}
      },
      math: {
        label: "Expressão Matemática",
        icon: "🧮",
        children: {
          editor: { 
            label: "Abrir Editor", 
            value: "__MATH_EDITOR__", 
            icon: "✏️" 
          }
        }
      },
      dice: {
        label: "Dados (Dice)",
        icon: "🎲",
        children: {
          editor: { 
            label: "Abrir Editor", 
            value: "__DICE_EDITOR__", 
            icon: "🎯" 
          }
        }
      }
    };

    // Adicionar stats
    stats.forEach(stat => {
      structure.stats.children[stat.id] = {
        label: stat.name?.default || `Stat ${stat.id}`,
        icon: "⚡",
        children: {
          name: { label: "Nome", value: `<stat:${stat.id}:name>`, icon: "🏷️" },
          value: { label: "Valor", value: `<stat:${stat.id}:value>`, icon: "🔢" },
          emoji: { label: "Emoji", value: `<stat:${stat.id}:emoji>`, icon: "😀" }
        }
      };
    });

    // Adicionar seções
    sections.forEach(section => {
      structure.sections.children[section.id] = {
        label: section.name?.default || `Seção ${section.id}`,
        icon: "📋",
        children: {
          name: { label: "Nome", value: `<section:${section.id}:name>`, icon: "🏷️" },
          emoji: { label: "Emoji", value: `<section:${section.id}:emoji>`, icon: "😀" }
        }
      };
    });

    return structure;
  }, [sections, stats]);

  // Navegar na estrutura
  const getCurrentLevel = () => {
    let current = menuStructure;
    for (const path of currentPath) {
      current = current[path]?.children || {};
    }
    return current;
  };

  // Filtrar itens do nível atual
  const getFilteredItems = () => {
    const currentLevel = getCurrentLevel();
    
    // Se há filtro, fazer busca global nos stats
    if (variableFilter !== "" && currentPath.length === 0) {
      const globalResults: Array<[string, any]> = [];
      
      // Buscar em todos os stats
      stats.forEach(stat => {
        const statName = (stat.name?.default || `Stat ${stat.id}`).toLowerCase();
        const filter = variableFilter.toLowerCase();
        
        if (statName.includes(filter) || stat.id.toString().includes(filter)) {
          // Adicionar todas as propriedades do stat que matched
          globalResults.push([`stat-${stat.id}-name`, {
            label: `📊 ${stat.name?.default || `Stat ${stat.id}`} → Nome`,
            value: `<stat:${stat.id}:name>`,
            icon: "🏷️"
          }]);
          globalResults.push([`stat-${stat.id}-value`, {
            label: `📊 ${stat.name?.default || `Stat ${stat.id}`} → Valor`,
            value: `<stat:${stat.id}:value>`,
            icon: "🔢"
          }]);
          globalResults.push([`stat-${stat.id}-emoji`, {
            label: `📊 ${stat.name?.default || `Stat ${stat.id}`} → Emoji`,
            value: `<stat:${stat.id}:emoji>`,
            icon: "😀"
          }]);
        }
      });
      
      // Buscar em todas as seções
      sections.forEach(section => {
        const sectionName = (section.name?.default || `Seção ${section.id}`).toLowerCase();
        const filter = variableFilter.toLowerCase();
        
        if (sectionName.includes(filter) || section.id.toString().includes(filter)) {
          globalResults.push([`section-${section.id}-name`, {
            label: `📄 ${section.name?.default || `Seção ${section.id}`} → Nome`,
            value: `<section:${section.id}:name>`,
            icon: "🏷️"
          }]);
          globalResults.push([`section-${section.id}-emoji`, {
            label: `📄 ${section.name?.default || `Seção ${section.id}`} → Emoji`,
            value: `<section:${section.id}:emoji>`,
            icon: "😀"
          }]);
        }
      });
      
      // Buscar em expressões matemáticas e dados
      if ("math".includes(variableFilter.toLowerCase()) || "matematica".includes(variableFilter.toLowerCase())) {
        globalResults.push(["math-editor", {
          label: "🧮 Expressão Matemática → Abrir Editor",
          value: "__MATH_EDITOR__",
          icon: "✏️"
        }]);
      }
      
      if ("dice".includes(variableFilter.toLowerCase()) || "dados".includes(variableFilter.toLowerCase())) {
        globalResults.push(["dice-editor", {
          label: "🎲 Dados (Dice) → Abrir Editor",
          value: "__DICE_EDITOR__",
          icon: "🎯"
        }]);
      }
      
      return globalResults;
    }
    
    // Busca normal no nível atual
    return Object.entries(currentLevel).filter(([key, item]: [string, any]) => {
      if (variableFilter === "") return true;
      return item.label.toLowerCase().includes(variableFilter.toLowerCase()) ||
             key.toLowerCase().includes(variableFilter.toLowerCase());
    });
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    onChange(newValue);
    
    // Verificar se digitou "/"
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
    
    if (lastSlashIndex !== -1) {
      const textAfterSlash = textBeforeCursor.slice(lastSlashIndex + 1);
      // Mostrar variáveis se "/" foi digitado e não há espaços depois
      if (!textAfterSlash.includes(' ') && !textAfterSlash.includes('\n')) {
        setVariableFilter(textAfterSlash);
        setShowVariables(true);
      } else {
        setShowVariables(false);
        setCurrentPath([]);
      }
    } else {
      setShowVariables(false);
      setCurrentPath([]);
    }
  };

  // Handle keyboard events for variable deletion
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const cursorPos = textarea.selectionStart;
    
    if (e.key === 'Backspace' || e.key === 'Delete') {
      // Check if we're about to delete part of a variable (regular or math)
      const variableRegex = /<(stat|section):(\d+):(name|value|emoji)>|<math:([^>]+)>/g;
      let match;
      
      while ((match = variableRegex.exec(value)) !== null) {
        const [fullMatch] = match;
        const varStart = match.index;
        const varEnd = match.index + fullMatch.length;
        
        // If cursor is inside or at the boundary of a variable, delete the whole variable
        if ((cursorPos > varStart && cursorPos <= varEnd) || 
            (e.key === 'Backspace' && cursorPos === varStart) ||
            (e.key === 'Delete' && cursorPos === varEnd)) {
          e.preventDefault();
          const newValue = value.slice(0, varStart) + value.slice(varEnd);
          onChange(newValue);
          
          setTimeout(() => {
            textarea.setSelectionRange(varStart, varStart);
            textarea.focus();
          }, 0);
          return;
        }
      }
    }
  };

  const handleMenuItemClick = (key: string, item: any) => {
    if (item.value === "__MATH_EDITOR__") {
      // Abrir editor matemático
      setShowVariables(false);
      setCurrentPath([]);
      setShowMathEditor(true);
    } else if (item.value === "__DICE_EDITOR__") {
      // Abrir editor de dados
      setShowVariables(false);
      setCurrentPath([]);
      setShowDiceEditor(true);
    } else if (item.value) {
      // É uma variável final - inserir
      insertVariable(item.value);
    } else if (item.children) {
      // Tem filhos - navegar mais fundo
      setCurrentPath([...currentPath, key]);
      setVariableFilter("");
    }
  };

  const goBack = () => {
    setCurrentPath(currentPath.slice(0, -1));
    setVariableFilter("");
  };

  const insertVariable = (variable: string) => {
    if (!ref.current) return;
    
    const textarea = ref.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textBefore = value.slice(0, start);
    const textAfter = value.slice(end);
    
    // Encontrar e remover o "/" e texto digitado após ele
    const lastSlashIndex = textBefore.lastIndexOf('/');
    const finalTextBefore = lastSlashIndex !== -1 ? textBefore.slice(0, lastSlashIndex) : textBefore;
    
    const newValue = finalTextBefore + variable + textAfter;
    onChange(newValue);
    
    setShowVariables(false);
    setCurrentPath([]);
    setVariableFilter("");
    
    // Reposicionar cursor
    setTimeout(() => {
      const newPos = finalTextBefore.length + variable.length;
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
    }, 0);
  };

  const confirmMathExpression = (expression: string) => {
    const mathVariable = `<math:${expression}>`;
    insertVariable(mathVariable);
    setShowMathEditor(false);
    setMathExpression("");
  };

  const confirmDiceExpression = (expression: string) => {
    const diceVariable = `<dice:${expression}>`;
    insertVariable(diceVariable);
    setShowDiceEditor(false);
    setDiceExpression("");
  };

  // Gerar cor automática baseada no ID e tipo
  const getVariableColor = (type: string, id: number) => {
    const colors = [
      'bg-red-100 text-red-800 border-red-200',
      'bg-blue-100 text-blue-800 border-blue-200', 
      'bg-green-100 text-green-800 border-green-200',
      'bg-yellow-100 text-yellow-800 border-yellow-200',
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-pink-100 text-pink-800 border-pink-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200',
      'bg-orange-100 text-orange-800 border-orange-200',
    ];
    
    const hash = (type + id).split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Renderizar variáveis como pills no texto (usado no editor)
  const renderTextWithPills = (text: string) => {
    const variableRegex = /<(stat|section):(\d+):(name|value|emoji)>|<math:([^>]+)>/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = variableRegex.exec(text)) !== null) {
      // Adicionar texto antes da variável
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      const [fullMatch, type, id, property, mathExpression] = match;
      
      if (mathExpression) {
        // É uma expressão matemática
        const colorClass = 'bg-purple-100 text-purple-800 border-purple-200';
        
        parts.push(
          <span 
            key={`${match.index}-${fullMatch}`} 
            className={`inline cursor-pointer rounded border ${colorClass}`}
            style={{ 
              fontSize: '0.875rem',
              lineHeight: '1.5rem',
              padding: '0 2px',
              display: 'inline',
              verticalAlign: 'baseline',
              whiteSpace: 'nowrap'
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              deleteVariable(fullMatch);
            }}
            title={`Clique para deletar: ${fullMatch}`}
          >
            🧮 {mathExpression.length > 20 ? mathExpression.slice(0, 20) + '...' : mathExpression}
          </span>
        );
      } else {
        // É uma variável normal
        const numId = parseInt(id);
        
        // Obter o nome da entidade para exibir na pill
        const entityName = (() => {
          if (type === 'stat') {
            const stat = stats.find(s => s.id === numId);
            return stat?.name?.[locale] || stat?.name?.default || `Stat ${id}`;
          } else if (type === 'section') {
            const section = sections.find(s => s.id === numId);
            return section?.name?.[locale] || section?.name?.default || `Seção ${id}`;
          }
          return `${type} ${id}`;
        })();
        
        // Texto da pill: Nome da entidade + propriedade
        const pillText = `${entityName} - ${property === 'name' ? 'Nome' : property === 'value' ? 'Valor' : property === 'emoji' ? 'Emoji' : property}`;
        const colorClass = getVariableColor(type, numId);
        
        parts.push(
          <span 
            key={`${match.index}-${fullMatch}`} 
            className={`inline cursor-pointer rounded border ${colorClass}`}
            style={{ 
              fontSize: '0.875rem',
              lineHeight: '1.5rem',
              padding: '0 2px',
              display: 'inline',
              verticalAlign: 'baseline',
              whiteSpace: 'nowrap'
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              deleteVariable(fullMatch);
            }}
            title={`Clique para deletar: ${fullMatch}`}
          >
            {pillText}
          </span>
        );
      }
      
      lastIndex = match.index + fullMatch.length;
    }
    
    // Adicionar texto restante
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts;
  };

  // Deletar variável completa
  const deleteVariable = (variableToDelete: string) => {
    const newValue = value.replace(variableToDelete, '');
    onChange(newValue);
    
    // Reposicionar cursor após a deleção
    setTimeout(() => {
      if (ref.current) {
        const newPos = value.indexOf(variableToDelete);
        ref.current.setSelectionRange(newPos, newPos);
        ref.current.focus();
      }
    }, 0);
  };

  return (
    <div className="relative">
      <Card className="border-dashed">
        <CardHeader className="py-2">
          <div className="flex items-center justify-between">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="write">Escrever</TabsTrigger>
                <TabsTrigger value="split">Dividido</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
            </Tabs>
            {(tab === "write" || tab === "split") && (
              <div className="flex items-center gap-1">
                <ToolbarButton title="Título" onClick={() => insert("# ", "", "Título")}>
                  <Heading1 className="h-4 w-4"/>
                </ToolbarButton>
                <ToolbarButton title="Negrito" onClick={() => insert("**","**","texto")}>
                  <Bold className="h-4 w-4"/>
                </ToolbarButton>
                <ToolbarButton title="Itálico" onClick={() => insert("*","*","texto")}>
                  <Italic className="h-4 w-4"/>
                </ToolbarButton>
                <ToolbarButton title="Link" onClick={() => insert("[","](https://)","texto")}>
                  <LinkIcon className="h-4 w-4"/>
                </ToolbarButton>
                <ToolbarButton title="Lista" onClick={() => insert("- ","","item")}>
                  <List className="h-4 w-4"/>
                </ToolbarButton>
                <ToolbarButton title="Lista ordenada" onClick={() => insert("1. ","","item")}>
                  <ListOrdered className="h-4 w-4"/>
                </ToolbarButton>
                <ToolbarButton title="Citação" onClick={() => insert("> ","","citação")}>
                  <Quote className="h-4 w-4"/>
                </ToolbarButton>
                <ToolbarButton title="Código" onClick={() => insert("`","`","code")}>
                  <Code className="h-4 w-4"/>
                </ToolbarButton>
                <ToolbarButton title="Variáveis (digite /)" onClick={() => setShowVariables(!showVariables)}>
                  <Code className="h-4 w-4"/>
                </ToolbarButton>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {tab === "write" ? (
            <div className="relative">
              {/* Overlay visual com pills */}
              <div className="min-h-[120px] border border-input bg-background px-3 py-2 text-sm ring-offset-background pointer-events-none overflow-auto whitespace-pre-wrap break-words rounded-md absolute inset-0 z-10" style={{ lineHeight: '1.5rem', fontSize: '0.875rem' }}>
                {value ? (
                  <div style={{ lineHeight: '1.5rem', fontSize: '0.875rem' }}>
                    {renderTextWithPills(value).map((part, i) => 
                      typeof part === 'string' ? 
                        <span key={i} className="whitespace-pre-wrap" style={{ lineHeight: '1.5rem', fontSize: '0.875rem' }}>{part}</span> : 
                        part
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground" style={{ lineHeight: '1.5rem', fontSize: '0.875rem' }}>
                    {placeholder || "Digite seu markdown aqui... Use / para inserir variáveis"}
                  </span>
                )}
              </div>
              
              {/* Textarea para capturar input e mostrar cursor */}
              <Textarea 
                ref={ref} 
                className="min-h-[120px] resize-y relative z-20 bg-transparent text-transparent selection:bg-primary/20" 
                value={value} 
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder=""
                style={{
                  caretColor: 'hsl(var(--foreground))',
                  color: 'transparent',
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  lineHeight: '1.5rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem'
                }}
              />
            </div>
          ) : tab === "split" ? (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="relative">
                <h4 className="text-sm font-medium mb-2">Editor</h4>
                <div className="relative">
                  {/* Overlay visual com pills */}
                  <div className="min-h-[120px] border border-input bg-background px-3 py-2 text-sm ring-offset-background pointer-events-none overflow-auto whitespace-pre-wrap break-words rounded-md absolute inset-0 z-10" style={{ lineHeight: '1.5rem', fontSize: '0.875rem' }}>
                    {value ? (
                      <div style={{ lineHeight: '1.5rem', fontSize: '0.875rem' }}>
                        {renderTextWithPills(value).map((part, i) => 
                          typeof part === 'string' ? 
                            <span key={i} className="whitespace-pre-wrap" style={{ lineHeight: '1.5rem', fontSize: '0.875rem' }}>{part}</span> : 
                            part
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground" style={{ lineHeight: '1.5rem', fontSize: '0.875rem' }}>
                        {placeholder || "Digite seu markdown aqui... Use / para inserir variáveis"}
                      </span>
                    )}
                  </div>
                  
                  {/* Textarea para capturar input e mostrar cursor */}
                  <Textarea 
                    ref={ref} 
                    className="min-h-[120px] resize-y relative z-20 bg-transparent text-transparent selection:bg-primary/20" 
                    value={value} 
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder=""
                    style={{
                      caretColor: 'hsl(var(--foreground))',
                      color: 'transparent',
                      border: 'none',
                      outline: 'none',
                      boxShadow: 'none',
                      lineHeight: '1.5rem',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Preview ao Vivo</h4>
                <div className="border rounded-xl p-4 bg-background min-h-[120px]">
                  <SmartPreview 
                    value={value} 
                    sections={sections} 
                    stats={stats} 
                    locale={locale}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="border rounded-xl p-4 bg-background min-h-[120px]">
              <SmartPreview 
                value={value} 
                sections={sections} 
                stats={stats} 
                locale={locale}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Menu Multi-Level de Variáveis */}
      {showVariables && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-hidden flex flex-col">
          <CardHeader className="py-2 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {currentPath.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={goBack}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                <div className="text-sm font-medium">
                  {variableFilter !== "" && currentPath.length === 0 ? 
                    `🔍 Busca: "${variableFilter}"` :
                    currentPath.length === 0 ? "Variáveis" : 
                    currentPath.map((path, i) => (
                      <span key={i}>
                        {i > 0 && " > "}
                        {menuStructure[currentPath[0]]?.label}
                        {i > 0 && ` > ${getCurrentLevel()[path]?.label || path}`}
                      </span>
                    ))
                  }
                </div>
              </div>
              <div className="flex items-center gap-1">
                {variableFilter !== "" && currentPath.length === 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setVariableFilter("")} title="Limpar busca">
                    🗑️
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setShowVariables(false)}>
                  ✕
                </Button>
              </div>
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            <CardContent className="p-2">
              <div className="space-y-1">
                {getFilteredItems().map(([key, item]: [string, any]) => (
                  <Button
                    key={key}
                    variant="ghost"
                    className="w-full justify-start h-auto p-2 text-left"
                    onClick={() => handleMenuItemClick(key, item)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-lg">{item.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium">{item.label}</div>
                        {item.value && (
                          <code className="text-xs bg-muted px-1 rounded mt-1 block">
                            {item.value}
                          </code>
                        )}
                      </div>
                      {item.children && <ChevronRight className="h-4 w-4" />}
                    </div>
                  </Button>
                ))}
                {getFilteredItems().length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">
                    Nenhuma variável encontrada.
                  </p>
                )}
              </div>
            </CardContent>
          </ScrollArea>
        </Card>
      )}

      {/* Editor de Expressão Matemática */}
      {showMathEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-background rounded-lg shadow-lg">
            <MathExpressionEditor
              value={mathExpression}
              onChange={setMathExpression}
              stats={stats}
              onConfirm={confirmMathExpression}
            />
            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowMathEditor(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Editor de Dice Notation */}
      {showDiceEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-background rounded-lg shadow-lg">
            <DiceNotationEditor
              value={diceExpression}
              onChange={setDiceExpression}
              stats={stats}
              onConfirm={confirmDiceExpression}
            />
            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDiceEditor(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================
// Compact Localization Editors
// =====================
function CompactTextLocalizationEditor({ value, onChange, label, placeholder, locales = ["pt-BR","en-US"]}:{ value: Localization<string>; onChange:(v:Localization<string>)=>void; label:string; placeholder?:string; locales?:Locale[]; }){
  const [curr, setCurr] = useState<Locale|"default">("default");
  const all = allLocalesFrom(value, locales);
  const update = (k:Locale|"default", v:string) => onChange({ ...value, [k]: v });
  return (
    <Card className="border-dashed">
      <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2">{label}
        <Select value={String(curr)} onValueChange={(value) => setCurr(value as any)}>
          <SelectTrigger className="ml-auto w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {all.map((opt)=>(
              <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>
            ))}
          </SelectContent>
        </Select></CardTitle></CardHeader>
      <CardContent>
        <Input value={(value as any)[curr] ?? ""} placeholder={curr==="default"?(placeholder??"Obrigatório"):`${placeholder??"Opcional"} (${curr})`} onChange={(e)=>update(curr,e.target.value)} />
      </CardContent>
    </Card>
  );
}
function CompactMarkdownLocalizationEditor({ value, onChange, label, locales=["pt-BR","en-US"], sections=[], stats=[] }:{ 
  value:Localization<string>; 
  onChange:(v:Localization<string>)=>void; 
  label:string; 
  locales?:Locale[];
  sections?: Section[];
  stats?: Stats[];
}){
  const [curr, setCurr] = useState<Locale|"default">("default");
  const all = allLocalesFrom(value, locales); 
  const update=(k:Locale|"default",v:string)=>onChange({ ...value, [k]: v });
  
  return (
    <Card className="border-dashed">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {label}
          <Select value={String(curr)} onValueChange={(value) => setCurr(value as any)}>
            <SelectTrigger className="ml-auto w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {all.map((opt)=>(
                <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <MarkdownEditor 
          value={(value as any)[curr] ?? ""} 
          onChange={(v)=>update(curr,v)} 
          placeholder={curr==="default"?"Obrigatório":`Opcional (${curr})`}
          sections={sections}
          stats={stats}
          locale={curr === "default" ? 'default' : curr}
        />
      </CardContent>
    </Card>
  );
}
function LabelLocalizationEditor({ value, onChange, label, locales=["pt-BR","en-US"]}:{ value:LabelLocalization; onChange:(v:LabelLocalization)=>void; label:string; locales?:Locale[]; }){
  return (<CompactTextLocalizationEditor value={value as any} onChange={(v)=>onChange(v as LabelLocalization)} label={label} placeholder="rótulo curto (ex.: Força)" locales={locales}/>);
}

// =====================
// MultiSelect de Seções (reusável)
// =====================
function MultiSelectSections({ sections, value, onChange, placeholder = "Selecionar seções", includeDefault = false }:{ sections:Section[]; value:number[]|undefined; onChange:(ids:number[])=>void; placeholder?:string; includeDefault?:boolean; }){
  const [open, setOpen] = useState(false);
  const selected = new Set(value ?? []);
  
  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(Array.from(next));
  };
  
  const labelFor = (id: number) => {
    if (id === -1) return "Padrão";
    return sections.find((s) => s.id === id)?.name?.default ?? String(id);
  };
  const selectedLabels = Array.from(selected).map(labelFor);
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          <div className="flex flex-wrap gap-1 items-center">
            {selected.size === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <>
                {selectedLabels.slice(0, 3).map((label, i) => (
                  <Badge key={i} variant="secondary" className="mr-1">
                    {label}
                  </Badge>
                ))}
                {selected.size > 3 && (
                  <Badge variant="outline">+{selected.size - 3}</Badge>
                )}
              </>
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[300px]" align="start">
        <div className="p-2">
          <div className="relative">
            <Input 
              placeholder="Buscar seção..." 
              className="mb-2"
            />
          </div>
          <ScrollArea className="max-h-64">
            <div className="space-y-1">
              {includeDefault && (
                <div
                  key={-1}
                  className="flex items-center space-x-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer border-b"
                  onClick={() => toggle(-1)}
                >
                  <Checkbox 
                    checked={selected.has(-1)} 
                    onCheckedChange={() => toggle(-1)}
                  />
                  <span className="flex-1 font-medium">
                    🏠 Padrão
                  </span>
                </div>
              )}
              {sections.length === 0 ? (
                <div className="text-sm text-muted-foreground p-2">
                  Nenhuma seção encontrada.
                </div>
              ) : (
                sections.map((section) => (
                  <div
                    key={section.id}
                    className="flex items-center space-x-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                    onClick={() => toggle(section.id)}
                  >
                    <Checkbox 
                      checked={selected.has(section.id)} 
                      onCheckedChange={() => toggle(section.id)}
                    />
                    <span className="flex-1">
                      {section.emoji && `${section.emoji} `}
                      {section.name?.default ?? `Seção ${section.id}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// =====================
// EmojiPicker (usando biblioteca externa)
// =====================
function CustomEmojiPicker({ value, onChange, placeholder = "ex.: 🗡️"}:{ value?:string; onChange:(v:string)=>void; placeholder?:string; }){
  const [open, setOpen] = useState(false);
  
  const handleEmojiClick = (emojiData: any) => {
    onChange(emojiData.emoji);
    setOpen(false);
    toast.success("Emoji selecionado!");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start font-normal">
          {value || <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <EmojiPickerReact 
          onEmojiClick={handleEmojiClick}
          autoFocusSearch={false}
          width={300}
          height={400}
        />
      </PopoverContent>
    </Popover>
  );
}

// =====================
// Dice, Replacement Editors
// =====================
function DiceEditor({ value, onChange, stats = [] }:{ value: Dice[]|undefined; onChange:(v?:Dice[])=>void; stats?:Stats[]; }){
  const dices = value ?? [];
  const [showDiceEditor, setShowDiceEditor] = useState(false);
  const [editingDiceIndex, setEditingDiceIndex] = useState<number>(-1);
  const [tempExpression, setTempExpression] = useState("");
  
  const add = () => {
    const newDice = { expression: "1d20" };
    onChange([...dices, newDice]);
    setEditingDiceIndex(dices.length);
    setTempExpression("1d20");
    setShowDiceEditor(true);
  };
  
  const remove = (i:number) => onChange(dices.filter((_,idx)=>idx!==i));
  
  const set = (i:number, patch:Partial<Dice>) => onChange(dices.map((d,idx)=>(idx===i?{...d,...patch}:d)));
  
  const openDiceEditor = (index: number) => {
    setEditingDiceIndex(index);
    setTempExpression(dices[index]?.expression || "1d20");
    setShowDiceEditor(true);
  };

  const confirmDiceExpression = (expression: string) => {
    if (editingDiceIndex >= 0 && editingDiceIndex < dices.length) {
      set(editingDiceIndex, { expression });
    }
    setShowDiceEditor(false);
    setEditingDiceIndex(-1);
    setTempExpression("");
    toast.success("Expressão de dados atualizada!");
  };

  const moveUp = (index: number) => {
    if (index > 0) {
      const newDices = [...dices];
      [newDices[index - 1], newDices[index]] = [newDices[index], newDices[index - 1]];
      onChange(newDices);
    }
  };

  const moveDown = (index: number) => {
    if (index < dices.length - 1) {
      const newDices = [...dices];
      [newDices[index], newDices[index + 1]] = [newDices[index + 1], newDices[index]];
      onChange(newDices);
    }
  };

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          🎲 Dados (Sistema de Condições)
          <Button size="sm" variant="secondary" onClick={add}>
            <Plus className="h-4 w-4"/> Adicionar dado
          </Button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Os dados são executados de cima para baixo. Primeiro dado com condição válida (ou sem condição) é executado.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3">
        {dices.length===0 && (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <div className="text-2xl mb-2">🎲</div>
            <p className="text-sm">Nenhum dado configurado.</p>
            <p className="text-xs">Adicione dados para criar sistema de rolagem.</p>
          </div>
        )}
        
        {dices.map((d,i)=>(
          <Card key={i} className={`${i === dices.length - 1 && !d.condition ? 'border-green-200 bg-green-50' : 'border-dashed'}`}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={i === dices.length - 1 && !d.condition ? "default" : "secondary"}>
                    {i === dices.length - 1 && !d.condition ? "🎯 Padrão" : `Dado ${i+1}`}
                  </Badge>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {d.expression || "1d20"}
                  </code>
                  {d.condition && (
                    <Badge variant="outline" className="text-xs">
                      Se: {d.condition.value1} {d.condition.operator} {d.condition.value2}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => moveUp(i)} 
                    disabled={i === 0}
                    title="Mover para cima"
                  >
                    <ChevronUp className="h-4 w-4"/>
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => moveDown(i)} 
                    disabled={i === dices.length - 1}
                    title="Mover para baixo"
                  >
                    <ChevronDown className="h-4 w-4"/>
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => openDiceEditor(i)}
                    title="Editar expressão"
                  >
                    🎲
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={()=>remove(i)}
                    title="Remover dado"
                    disabled={dices.length === 1}
                  >
                    <Trash2 className="h-4 w-4"/>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              
              {/* Condição (opcional exceto para o último) */}
              {i < dices.length - 1 && (
                <div className="grid gap-2">
                  <Label className="text-xs">Condição (quando executar este dado)</Label>
                  <div className="grid md:grid-cols-3 gap-2">
                    <div className="flex gap-2 items-center">
                      <Label className="min-w-16 text-xs">Valor 1</Label>
                      <Input 
                        value={d.condition?.value1 ?? ""} 
                        onChange={(e)=>set(i,{condition:{...(d.condition??{operator:"==",value1:"",value2:""}), value1:e.target.value}})} 
                        placeholder="<stat:1:value> ou 10"
                        className="text-xs font-mono"
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                      <Label className="min-w-16 text-xs">Operador</Label>
                      <Select 
                        value={d.condition?.operator ?? "=="} 
                        onValueChange={(val) => set(i,{condition:{...(d.condition??{operator:"==",value1:"",value2:""}), operator:val as any}})}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="==">=</SelectItem>
                          <SelectItem value="!=">≠</SelectItem>
                          <SelectItem value="<">&lt;</SelectItem>
                          <SelectItem value=">">&gt;</SelectItem>
                          <SelectItem value="<=">&le;</SelectItem>
                          <SelectItem value=">=">&ge;</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Label className="min-w-16 text-xs">Valor 2</Label>
                      <Input 
                        value={d.condition?.value2 ?? ""} 
                        onChange={(e)=>set(i,{condition:{...(d.condition??{operator:"==",value1:"",value2:""}), value2:e.target.value}})} 
                        placeholder="<stat:2:value> ou 5"
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    🧮 <strong>Suporte a expressões matemáticas:</strong> Use &lt;stat:ID:value&gt; para variáveis, 
                    operações como (10 + 5), funções como max(5, 10), etc.
                  </p>
                  
                  {/* Preview da condição */}
                  {d.condition?.value1 && d.condition?.value2 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
                      <div className="text-xs font-medium text-blue-700 mb-1">Preview da condição:</div>
                      <code className="text-xs text-blue-600">
                        {(() => {
                          try {
                            // Substituir variáveis por valores exemplo para preview
                            const previewValue1 = d.condition.value1.replace(/<stat:(\d+):value>/g, (_, id) => {
                              const stat = stats.find(s => s.id === parseInt(id));
                              if (!stat) return '3';
                              switch (stat.type) {
                                case 'numeric': return String(stat.min || 3);
                                case 'boolean': return '1';
                                case 'enum': 
                                  if (Array.isArray(stat.options) && stat.options.length > 0) {
                                    return String(stat.options[0].value);
                                  }
                                  return '2';
                                default: return '3';
                              }
                            });
                            
                            const previewValue2 = d.condition.value2.replace(/<stat:(\d+):value>/g, (_, id) => {
                              const stat = stats.find(s => s.id === parseInt(id));
                              if (!stat) return '3';
                              switch (stat.type) {
                                case 'numeric': return String(stat.max || 5);
                                case 'boolean': return '0';
                                case 'enum': 
                                  if (Array.isArray(stat.options) && stat.options.length > 1) {
                                    return String(stat.options[1].value);
                                  }
                                  return '1';
                                default: return '5';
                              }
                            });
                            
                            // Avaliar expressões matemáticas se necessário
                            let evalValue1: any = previewValue1;
                            let evalValue2: any = previewValue2;
                            
                            try {
                              if (isNaN(Number(previewValue1)) && previewValue1.includes('(')) {
                                evalValue1 = String(evaluate(previewValue1));
                              }
                            } catch {
                              evalValue1 = previewValue1;
                            }
                            
                            try {
                              if (isNaN(Number(previewValue2)) && previewValue2.includes('(')) {
                                evalValue2 = String(evaluate(previewValue2));
                              }
                            } catch {
                              evalValue2 = previewValue2;
                            }
                            
                            return `${evalValue1} ${d.condition.operator} ${evalValue2}`;
                          } catch {
                            return '[Erro na avaliação da condição]';
                          }
                        })()}
                      </code>
                    </div>
                  )}
                </div>
              )}
              
              {i === dices.length - 1 && !d.condition && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <div className="flex items-center gap-2 text-green-700">
                    <span className="text-lg">🎯</span>
                    <div>
                      <div className="font-medium text-sm">Dado Padrão</div>
                      <div className="text-xs">Este dado será executado se nenhuma condição anterior for válida.</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        
        {/* Editor de Dice Notation Modal */}
        {showDiceEditor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-background rounded-lg shadow-lg">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Editor de Expressão de Dados</h3>
                <p className="text-sm text-muted-foreground">
                  Editar dado {editingDiceIndex + 1}
                </p>
              </div>
              <DiceNotationEditor
                value={tempExpression}
                onChange={setTempExpression}
                stats={stats}
                onConfirm={confirmDiceExpression}
              />
              <div className="p-4 border-t flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDiceEditor(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =====================
// ReplacementEditor - Sistema de substituições baseado nos stats
// =====================
function ReplacementEditor({ value, onChange, stats = [], dices = [] }:{ 
  value: Replacement[] | undefined; 
  onChange: (v?: Replacement[]) => void;
  stats?: Stats[];
  dices?: Dice[];
}){
  const replacements = value ?? [];
  const [searchFilter, setSearchFilter] = useState("");
  
  // Função para extrair IDs de stats usados nas expressões de dados
  const getStatsUsedInDices = (): number[] => {
    const usedStatIds = new Set<number>();
    
    dices.forEach(dice => {
      if (dice.expression) {
        // Procurar por <stat:ID:value> na expressão
        const regex = /<stat:(\d+):value>/g;
        let match;
        while ((match = regex.exec(dice.expression)) !== null) {
          const statId = parseInt(match[1]);
          usedStatIds.add(statId);
        }
      }
      
      // Também verificar nas condições
      if (dice.condition) {
        const checkConditionValue = (value: string) => {
          const regex = /<stat:(\d+):value>/g;
          let match;
          while ((match = regex.exec(value)) !== null) {
            const statId = parseInt(match[1]);
            usedStatIds.add(statId);
          }
        };
        
        checkConditionValue(dice.condition.value1);
        checkConditionValue(dice.condition.value2);
      }
    });
    
    return Array.from(usedStatIds);
  };
  
  // Filtrar stats que podem ser usados como chaves - apenas os que são realmente usados nos dados
  const usedStatIds = getStatsUsedInDices();
  const validKeyStats = stats.filter(stat => 
    usedStatIds.includes(stat.id) &&
    (stat.type === 'numeric' || 
     stat.type === 'boolean' || 
     stat.type === 'enum' || 
     stat.type === 'calculated')
  );
  
  // Filtrar stats que podem ser opções de substituição (todos não-string)
  const validOptionStats = stats.filter(stat => 
    stat.type === 'numeric' || 
    stat.type === 'boolean' || 
    stat.type === 'enum' || 
    stat.type === 'calculated'
  );

  // Filtrar stats baseado na busca
  const filteredValidOptionStats = validOptionStats.filter(stat => {
    if (!searchFilter.trim()) return true;
    
    const searchTerm = searchFilter.toLowerCase();
    const statName = (stat.name?.default || '').toLowerCase();
    const statType = stat.type.toLowerCase();
    const statId = stat.id.toString();
    
    return statName.includes(searchTerm) || 
           statType.includes(searchTerm) || 
           statId.includes(searchTerm);
  });

  const add = () => {
    if (validKeyStats.length === 0) {
      return; // Não pode adicionar sem stats válidos
    }
    
    const newReplacement: Replacement = { 
      key: validKeyStats[0].id, 
      options: [validKeyStats[0].id] // Incluir a própria key por padrão
    };
    onChange([...replacements, newReplacement]);
  };
  
  const remove = (i: number) => onChange(replacements.filter((_, idx) => idx !== i));
  
  const set = (i: number, patch: Partial<Replacement>) => 
    onChange(replacements.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const toggleOption = (replacementIndex: number, statId: number) => {
    const replacement = replacements[replacementIndex];
    const currentOptions = replacement.options || [];
    
    if (currentOptions.includes(statId)) {
      // Remover da lista
      const newOptions = currentOptions.filter(id => id !== statId);
      set(replacementIndex, { options: newOptions });
    } else {
      // Adicionar à lista
      const newOptions = [...currentOptions, statId];
      set(replacementIndex, { options: newOptions });
    }
  };

  const getStatById = (id: number) => stats.find(s => s.id === id);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          🔄 Sistema de Substituições (Replacements)
          <Button size="sm" variant="secondary" onClick={add} disabled={validKeyStats.length === 0}>
            <Plus className="h-4 w-4"/> Adicionar
          </Button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Configure quais stats podem ser substituídos por outros durante as rolagens. 
          Apenas stats usados nas expressões de dados deste card podem ser configurados como chaves.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3">
        {validKeyStats.length === 0 && usedStatIds.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <div className="text-2xl mb-2">🎲</div>
            <p className="text-sm">Nenhum dado configurado ainda.</p>
            <p className="text-xs">Configure dados primeiro para poder criar substituições.</p>
          </div>
        )}
        
        {validKeyStats.length === 0 && usedStatIds.length > 0 && (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <div className="text-2xl mb-2">⚠️</div>
            <p className="text-sm">Stats usados nos dados não são compatíveis.</p>
            <p className="text-xs">Apenas stats numéricos, booleanos, enum ou calculados podem ter substituições.</p>
          </div>
        )}
        {replacements.length === 0 && validKeyStats.length > 0 && (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <div className="text-2xl mb-2">🔄</div>
            <p className="text-sm">Nenhuma substituição configurada.</p>
            <p className="text-xs">Adicione substituições para permitir trocas de stats nas rolagens.</p>
          </div>
        )}
        
        {replacements.map((replacement, i) => {
          const keyStat = getStatById(replacement.key);
          
          return (
            <Card key={i} className="border-dashed">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Substituição {i + 1}</Badge>
                    {keyStat && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🔑</span>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {keyStat.emoji && `${keyStat.emoji} `}
                          {keyStat.name?.default || `Stat ${keyStat.id}`}
                        </code>
                      </div>
                    )}
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => remove(i)}
                    title="Remover substituição"
                  >
                    <Trash2 className="h-4 w-4"/>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                
                {/* Seleção da chave (stat principal) */}
                <div className="grid gap-2">
                  <Label className="text-xs">Stat Principal (chave)</Label>
                  <Select 
                    value={String(replacement.key)} 
                    onValueChange={(val) => {
                      const newKey = parseInt(val);
                      const currentOptions = replacement.options || [];
                      
                      // Garantir que a nova key está nas opções
                      const newOptions = currentOptions.includes(newKey) 
                        ? currentOptions 
                        : [...currentOptions, newKey];
                      
                      set(i, { key: newKey, options: newOptions });
                    }}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {validKeyStats.map((stat) => (
                        <SelectItem key={stat.id} value={String(stat.id)}>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{stat.type}</Badge>
                            <span>
                              {stat.emoji && `${stat.emoji} `}
                              {stat.name?.default || `Stat ${stat.id}`}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    O stat que poderá ser substituído nas rolagens.
                  </p>
                </div>

                {/* Opções de substituição */}
                <div className="grid gap-2">
                  <Label className="text-xs">
                    Opções de Substituição ({(replacement.options || []).length} selecionadas{searchFilter ? ` • ${filteredValidOptionStats.length} de ${validOptionStats.length} exibidos` : ''})
                  </Label>
                  
                  {/* Campo de busca */}
                  <div className="relative">
                    <Input
                      placeholder="Buscar stats por nome, tipo ou ID..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="text-xs"
                    />
                    {searchFilter && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-1 top-1 h-6 w-6"
                        onClick={() => setSearchFilter("")}
                        title="Limpar busca"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  <ScrollArea className="h-32 border rounded-md p-2">
                    {filteredValidOptionStats.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {searchFilter ? 
                          `Nenhum stat encontrado para "${searchFilter}"` :
                          "Nenhum stat disponível para substituição."
                        }
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {filteredValidOptionStats.map((stat) => {
                            const isSelected = (replacement.options || []).includes(stat.id);
                            const isKey = stat.id === replacement.key;
                            
                            return (
                              <div 
                                key={stat.id}
                                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                                  isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-muted'
                                }`}
                                onClick={() => toggleOption(i, stat.id)}
                              >
                                <Checkbox 
                                  checked={isSelected}
                                  onChange={() => toggleOption(i, stat.id)}
                                />
                                <Badge variant={isKey ? "default" : "secondary"}>{stat.type}</Badge>
                                <div className="flex-1">
                                  <div className="font-medium text-sm">
                                    {stat.emoji && `${stat.emoji} `}
                                    {stat.name?.default || `Stat ${stat.id}`}
                                    {isKey && <span className="text-xs text-muted-foreground ml-2">(chave)</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">
                    Stats que podem substituir o stat principal. Clique para selecionar/deselecionar.
                  </p>
                </div>

                {/* Preview das substituições */}
                {(replacement.options || []).length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="text-xs font-medium text-blue-700 mb-2">Preview:</div>
                    <div className="text-xs text-blue-600">
                      <strong>{keyStat?.name?.default || `Stat ${replacement.key}`}</strong> pode ser substituído por:{' '}
                      {(replacement.options || [])
                        .map(optionId => {
                          const optionStat = getStatById(optionId);
                          return optionStat?.name?.default || `Stat ${optionId}`;
                        })
                        .join(', ')}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}

// =====================
// Stat Editors
// =====================
function BaseStatFields({ stat, onPatch, sections }:{ stat:BaseStat; onPatch:(p:Partial<BaseStat>)=>void; sections:Section[] }){
  return (
    <div className="grid gap-3">
      <div className="grid md:grid-cols-3 gap-3">
        <div className="grid gap-2"><Label>Emoji</Label><CustomEmojiPicker value={stat.emoji ?? ""} onChange={(v)=>onPatch({ emoji: v })} /></div>
        <div className="grid gap-2 md:col-span-2"><Label>Páginas editáveis (seções)</Label>
          <MultiSelectSections sections={sections} value={stat.edit_page} onChange={(ids)=>onPatch({ edit_page: ids })} placeholder="Selecione as seções onde este stat é editável" />
        </div>
      </div>
      <LabelLocalizationEditor label="Nome (localizado)" value={stat.name} onChange={(v)=>onPatch({ name: v } as any)} />
    </div>
  );
}
function StatNumericEditor({ value, onChange, sections, allStats = [] }:{ 
  value:StatsNumeric; 
  onChange:(v:StatsNumeric)=>void; 
  sections:Section[];
  allStats?: Stats[];
}){ 
  const [showLimits, setShowLimits] = useState<boolean>(
    value.min !== undefined || value.max !== undefined
  );
  
  const patch=(p:Partial<StatsNumeric>)=>onChange({ ...value, ...p }); 
  
  const handleLimitsToggle = (enabled: boolean) => {
    setShowLimits(enabled);
    if (!enabled) {
      // Remove min/max quando desabilitado
      const { min, max, ...rest } = value;
      onChange(rest as StatsNumeric);
    } else {
      // Define valores padrão quando habilitado
      patch({ min: value.min ?? 0, max: value.max ?? 10 });
    }
  };
  
  return (
    <div className="grid gap-4">
      <BaseStatFields stat={value} onPatch={patch} sections={sections}/>
      
      <div className="flex items-center space-x-2">
        <Switch 
          id="limits-toggle" 
          checked={showLimits} 
          onCheckedChange={handleLimitsToggle}
        />
        <Label htmlFor="limits-toggle">Definir limites (min/max)</Label>
      </div>
      
      {showLimits && (
        <div className="grid md:grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Mínimo</Label>
            <Input 
              type="number" 
              value={value.min ?? 0} 
              onChange={(e)=>patch({min:Number(e.target.value)})}
            />
          </div>
          <div className="grid gap-2">
            <Label>Máximo</Label>
            <Input 
              type="number" 
              value={value.max ?? 10} 
              onChange={(e)=>patch({max:Number(e.target.value)})}
            />
          </div>
        </div>
      )}
      
      <DiceEditor value={value.dices} onChange={(v)=>patch({ dices:v })} stats={allStats}/>
      <ReplacementEditor value={value.replacements} onChange={(v)=>patch({ replacements:v })} stats={allStats} dices={value.dices}/>
    </div>
  );
} 
function OptionEditor({ value, onChange }:{ value:StatsEnumOption; onChange:(v:StatsEnumOption)=>void }){
  const patch=(p:Partial<StatsEnumOption>)=>onChange({ ...value, ...p });
  return (
    <div className="grid gap-3 border rounded-xl p-3">
      <div className="grid md:grid-cols-3 gap-2">
        <div className="grid gap-2">
          <Label>Valor</Label>
          <Input 
            type="number" 
            value={value.value} 
            onChange={(e)=>patch({ value:Number(e.target.value) })}
          />
        </div>
        <div className="grid gap-2">
          <Label>Emoji</Label>
          <CustomEmojiPicker 
            value={value.emoji ?? ""} 
            onChange={(v)=>patch({ emoji: v })}
          />
        </div>
      </div>
      <LabelLocalizationEditor 
        label="Nome (localizado)" 
        value={value.name} 
        onChange={(v)=>patch({ name: v } as any)} 
      />
    </div>
  );
}
function StatEnumEditor({ value, onChange, sections, allStats }:{ value:StatsEnum; onChange:(v:StatsEnum)=>void; sections:Section[]; allStats:Stats[] }){
  const [expandedOptions, setExpandedOptions] = useState<Set<number>>(new Set([0])); // Primeira opção expandida por padrão
  
  const patch=(p:Partial<StatsEnum>)=>onChange({ ...value, ...p });
  const isNumberCompat = typeof value.options === "number";
  const opts = (Array.isArray(value.options) ? value.options : []) as StatsEnumOption[];
  
  // Verificar valores duplicados
  const duplicateValues = opts.reduce((acc, option, index) => {
    const duplicateIndex = opts.findIndex((o, i) => i !== index && o.value === option.value);
    if (duplicateIndex !== -1) {
      acc.add(option.value);
    }
    return acc;
  }, new Set<number>());
  
  const addOption = () => {
    if (opts.length >= 25) {
      toast.error("Máximo de 25 opções permitidas");
      return;
    }
    const newIndex = opts.length;
    patch({ options: [...opts, { value: (opts.at(-1)?.value ?? 0) + 1, name: emptyLabelLoc() }] });
    // Expandir a nova opção automaticamente
    setExpandedOptions(prev => new Set([...prev, newIndex]));
  };
  
  const setOption=(i:number,v:StatsEnumOption)=>patch({ options: opts.map((o,idx)=>(idx===i?v:o)) });
  const removeOption=(i:number)=>{
    patch({ options: opts.filter((_,idx)=>idx!==i) });
    // Remover do conjunto de expandidos
    setExpandedOptions(prev => {
      const newSet = new Set(prev);
      newSet.delete(i);
      // Reajustar índices dos itens expandidos após a remoção
      const adjustedSet = new Set<number>();
      newSet.forEach(index => {
        if (index > i) {
          adjustedSet.add(index - 1);
        } else {
          adjustedSet.add(index);
        }
      });
      return adjustedSet;
    });
  };
  
  const toggleExpanded = (index: number) => {
    setExpandedOptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };
  
  // Filtrar stats que são enum e têm lista de opções (não ID)
  const availableEnumStats = allStats.filter(stat => 
    stat.type === "enum" && 
    Array.isArray(stat.options) && 
    stat.options.length > 0 &&
    stat.id !== value.id // Não incluir o próprio stat
  ) as StatsEnum[];
  
  return (
    <div className="grid gap-4">
      <BaseStatFields stat={value} onPatch={patch} sections={sections}/>
      <div className="flex items-center gap-2">
        <Switch 
          checked={!isNumberCompat} 
          onCheckedChange={(ch)=>patch({ options: ch ? [] : 0 })}
        />
        <span className="text-sm">Usar lista de opções próprias (desligado = referenciar outro enum)</span>
      </div>
      
      {isNumberCompat ? (
        <div className="grid gap-2">
          <Label>Referenciar opções de outro Enum</Label>
          {availableEnumStats.length === 0 ? (
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md text-center">
              📭 Não existem outros enums com opções disponíveis.
              <br />
              <span className="text-xs">Crie outros enums com lista de opções para poder referenciá-los aqui.</span>
            </div>
          ) : (
            <>
              <Select 
                value={typeof value.options === "number" && value.options > 0 ? String(value.options) : ""} 
                onValueChange={(val) => {
                  const numVal = parseInt(val);
                  if (!isNaN(numVal) && numVal > 0) {
                    patch({ options: numVal });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um enum com opções definidas" />
                </SelectTrigger>
                <SelectContent>
                  {availableEnumStats.map((stat) => (
                    <SelectItem key={stat.id} value={String(stat.id)}>
                      {stat.emoji && `${stat.emoji} `}
                      {stat.name?.default || `Stat ${stat.id}`}
                      {Array.isArray(stat.options) && ` (${stat.options.length} opções)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {typeof value.options === "number" && value.options > 0 && (
                <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                  <strong>Referenciando:</strong> {(() => {
                    const referencedStat = availableEnumStats.find(s => s.id === value.options);
                    if (referencedStat && Array.isArray(referencedStat.options)) {
                      return `${referencedStat.name?.default || `Stat ${referencedStat.id}`} com ${referencedStat.options.length} opções`;
                    }
                    return "Enum não encontrado";
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="flex justify-between items-center">
            <div>
              <Label>Opções Próprias</Label>
              <p className="text-xs text-muted-foreground">
                {opts.length}/25 opções
                {duplicateValues.size > 0 && (
                  <span className="text-red-500 ml-2">
                    ⚠️ Valores duplicados: {Array.from(duplicateValues).join(', ')}
                  </span>
                )}
              </p>
            </div>
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={addOption}
              disabled={opts.length >= 25}
            >
              <Plus className="h-4 w-4"/> Adicionar opção
            </Button>
          </div>
          {opts.length===0 && <p className="text-sm text-muted-foreground">Sem opções.</p>}
          <div className="grid gap-3">{opts.map((o,i)=>(
            <Collapsible key={i} open={expandedOptions.has(i)} onOpenChange={() => toggleExpanded(i)}>
              <Card className={duplicateValues.has(o.value) ? "border-red-200 border-2" : ""}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="py-3 cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{o.emoji || "📋"}</span>
                        <div>
                          <div className="font-medium text-sm">
                            {o.name?.default || `Opção ${o.value}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Valor: {o.value}
                            {duplicateValues.has(o.value) && (
                              <span className="text-red-500 ml-2">⚠️ Duplicado</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeOption(i);
                          }}
                        >
                          <Trash2 className="h-4 w-4"/>
                        </Button>
                        {expandedOptions.has(i) ? 
                          <ChevronUp className="h-4 w-4" /> : 
                          <ChevronDown className="h-4 w-4" />
                        }
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <OptionEditor value={o} onChange={(v)=>setOption(i,v)} />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}</div>
        </div>
      )}
      
      <DiceEditor value={value.dices} onChange={(v)=>patch({ dices:v })} stats={allStats}/>
      <ReplacementEditor value={value.replacements} onChange={(v)=>patch({ replacements:v })} stats={allStats} dices={value.dices}/>
    </div>
  );
}
function StatBooleanEditor({ value, onChange, sections, allStats = [] }:{ 
  value:StatsBoolean; 
  onChange:(v:StatsBoolean)=>void; 
  sections:Section[];
  allStats?: Stats[];
}){ 
  const patch=(p:Partial<StatsBoolean>)=>onChange({ ...value, ...p }); 
  return (
    <div className="grid gap-4">
      <BaseStatFields stat={value} onPatch={patch} sections={sections}/>
      <DiceEditor value={value.dices} onChange={(v)=>patch({ dices:v })} stats={allStats}/>
      <ReplacementEditor value={value.replacements} onChange={(v)=>patch({ replacements:v })} stats={allStats} dices={value.dices}/>
    </div>
  ); 
}
function StatStringEditor({ value, onChange, sections }:{ value:StatsString; onChange:(v:StatsString)=>void; sections:Section[] }){ 
  const [showLimits, setShowLimits] = useState<boolean>(
    value.minLength !== undefined || value.maxLength !== undefined
  );
  
  const patch=(p:Partial<StatsString>)=>onChange({ ...value, ...p }); 
  
  const handleLimitsToggle = (enabled: boolean) => {
    setShowLimits(enabled);
    if (!enabled) {
      // Remove minLength/maxLength quando desabilitado
      const { minLength, maxLength, ...rest } = value;
      onChange(rest as StatsString);
    } else {
      // Define valores padrão quando habilitado
      patch({ minLength: value.minLength ?? 0, maxLength: value.maxLength ?? 100 });
    }
  };
  
  return (
    <div className="grid gap-4">
      <BaseStatFields stat={value} onPatch={patch} sections={sections}/>
      
      <div className="flex items-center space-x-2">
        <Switch 
          id="string-limits-toggle" 
          checked={showLimits} 
          onCheckedChange={handleLimitsToggle}
        />
        <Label htmlFor="string-limits-toggle">Definir limites de caracteres</Label>
      </div>
      
      {showLimits && (
        <div className="grid md:grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Mín. caracteres</Label>
            <Input 
              type="number" 
              value={value.minLength ?? 0} 
              onChange={(e)=>patch({minLength:Number(e.target.value)})}
            />
          </div>
          <div className="grid gap-2">
            <Label>Máx. caracteres</Label>
            <Input 
              type="number" 
              value={value.maxLength ?? 100} 
              onChange={(e)=>patch({maxLength:Number(e.target.value)})}
            />
          </div>
        </div>
      )}
    </div>
  );
}
function StatCalculatedEditor({ value, onChange, sections, allStats }:{ value:StatsCalculated; onChange:(v:StatsCalculated)=>void; sections:Section[]; allStats:Stats[] }){ 
  const [showMathEditor, setShowMathEditor] = useState(false);
  const [tempFormula, setTempFormula] = useState("");
  
  const patch=(p:Partial<StatsCalculated>)=>onChange({ ...value, ...p }); 
  
  // Filtrar stats que podem ser usados (excluir o próprio stat e stats que dependem dele)
  const getAvailableStats = () => {
    return allStats.filter(stat => {
      // Excluir o próprio stat
      if (stat.id === value.id) return false;
      
      // Excluir stats do tipo string
      if (stat.type === 'string') return false;
      
      // Para stats calculated, verificar se não criariam ciclo
      if (stat.type === 'calculated') {
        // Simular se incluir este stat criaria recursão
        const testFormula = `${value.formula} + <stat:${stat.id}:value>`;
        if (hasCircularDependency(value.id, testFormula, allStats)) {
          return false;
        }
      }
      
      return true;
    });
  };

  const openMathEditor = () => {
    setTempFormula(value.formula || "");
    setShowMathEditor(true);
  };

  const confirmFormula = (formula: string) => {
    // Verificar se a nova fórmula não cria recursão
    if (hasCircularDependency(value.id, formula, allStats)) {
      toast.error("Esta fórmula criaria uma dependência circular!");
      return;
    }
    
    patch({ formula });
    setShowMathEditor(false);
    setTempFormula("");
    toast.success("Fórmula atualizada!");
  }; 
  
  return (
    <div className="grid gap-4">
      <BaseStatFields stat={value} onPatch={patch} sections={sections}/>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>Fórmula</Label>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={openMathEditor}
            className="flex items-center gap-2"
          >
            🧮 Abrir Editor Matemático
          </Button>
        </div>
        <Input 
          value={value.formula} 
          onChange={(e)=>patch({ formula:e.target.value })} 
          placeholder="ex.: <stat:1:value> + <stat:2:value> / 2"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Use variáveis como &lt;stat:ID:value&gt; ou abra o editor matemático para uma experiência visual.
        </p>
      </div>
      <DiceEditor value={value.dices} onChange={(v)=>patch({ dices:v })} stats={allStats}/>
      <ReplacementEditor value={value.replacements} onChange={(v)=>patch({ replacements:v })} stats={allStats} dices={value.dices}/>
      
      {/* Editor Matemático Modal */}
      {showMathEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-background rounded-lg shadow-lg">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Editor de Fórmula Calculada</h3>
              <p className="text-sm text-muted-foreground">
                Stats disponíveis (filtrados para evitar recursão)
              </p>
            </div>
            <MathExpressionEditor
              value={tempFormula}
              onChange={setTempFormula}
              stats={getAvailableStats()}
              onConfirm={confirmFormula}
            />
            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowMathEditor(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );}
function PolymorphicStatEditor({ value, onChange, sections, allStats }:{ value:Stats; onChange:(v:Stats)=>void; sections:Section[]; allStats:Stats[] }){
  return (
    <div className="grid gap-4">
      {value.type==="numeric" && <StatNumericEditor value={value} onChange={onChange as any} sections={sections} allStats={allStats}/>} 
      {value.type==="enum" && <StatEnumEditor value={value} onChange={onChange as any} sections={sections} allStats={allStats}/>} 
      {value.type==="boolean" && <StatBooleanEditor value={value} onChange={onChange as any} sections={sections} allStats={allStats}/>} 
      {value.type==="string" && <StatStringEditor value={value} onChange={onChange as any} sections={sections}/>} 
      {value.type==="calculated" && <StatCalculatedEditor value={value} onChange={onChange as any} sections={sections} allStats={allStats}/>} 
    </div>
  );
}

// =====================
// Section Editor (agora usa MultiSelectSections para view_pages)
// =====================
function SectionEditor({ value, onChange, sections, stats = [] }:{ value:Section; onChange:(v:Section)=>void; sections:Section[]; stats?: Stats[]; }){
  const [isOpen, setIsOpen] = useState(false);
  const patch=(p:Partial<Section>)=>onChange({ ...value, ...p });
  // Você pode optar por filtrar a própria seção da lista se não quiser permitir self-reference:
  const sectionChoices = sections; // .filter((s)=>s.id!==value.id)
  
  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full text-left">
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">
              {value.name?.default || `Seção ${value.id}`}
            </CardTitle>
            <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="grid gap-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="flex items-end gap-2"><Switch checked={value.quick_edit_btn} onCheckedChange={(v)=>patch({ quick_edit_btn:v })}/><Label>Botão de edição rápida</Label></div>
              <div className="grid gap-2">
                <Label>Emoji</Label>
                <CustomEmojiPicker value={value.emoji ?? ""} onChange={(v)=>patch({ emoji: v })}/>
              </div>
              <div className="grid gap-2">
                <Label>Páginas exibidas (seções)</Label>
                <MultiSelectSections
                  sections={sectionChoices}
                  value={value.view_pages}
                  onChange={(ids)=>patch({ view_pages: ids })}
                  placeholder="Selecione em quais páginas (seções) essa seção também aparece"
                  includeDefault={true}
                />
              </div>
            </div>
            <LabelLocalizationEditor label="Nome (localizado)" value={value.name} onChange={(v)=>patch({ name:v } as any)} />
            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Preview</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid md:grid-cols-3 gap-3"><div className="grid gap-2"><Label>Tipo</Label>
                  <Select value={value.preview.type} onValueChange={(val) => patch({ preview:{ ...value.preview, type:val as any } })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">string</SelectItem>
                      <SelectItem value="img">img</SelectItem>
                    </SelectContent>
                  </Select></div></div>
                {value.preview.type==="string" ? (
                  <CompactMarkdownLocalizationEditor 
                    value={value.preview.content} 
                    onChange={(v)=>patch({ preview:{ ...value.preview, content:v } })} 
                    label="Conteúdo (Markdown)" 
                    sections={sections}
                    stats={stats}
                  />
                ) : (
                  <CompactTextLocalizationEditor value={value.preview.content} onChange={(v)=>patch({ preview:{ ...value.preview, content:v } })} label="URL da imagem" placeholder="https://..." />
                )}
              </CardContent>
            </Card>
            <div className="text-xs text-muted-foreground">Dica: você pode referenciar variáveis como <code>&lt;stat:ID:name&gt;</code> no Markdown.</div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// =====================
// Validators
// =====================
function validate(system:RPGSystem): string[] {
  const errs:string[] = [];
  if (!system.config?.id && system.config?.id !== 0) errs.push("config.id é obrigatório");
  if (!system.config?.name?.default) errs.push("config.name.default é obrigatório");
  if (!Array.isArray(system.stats)) errs.push("stats deve ser um array");
  if (!Array.isArray(system.sections)) errs.push("sections deve ser um array");

  const ids = new Set<number>();
  system.stats.forEach((s, idx) => {
    if (ids.has(s.id)) errs.push(`stats[${idx}] id duplicado: ${s.id}`);
    ids.add(s.id);
    if (!s.name?.default) errs.push(`stats[${idx}].name.default é obrigatório`);
    if (s.type === "numeric") {
      const n = s as StatsNumeric;
      if (typeof n.min === "number" && typeof n.max === "number" && n.min! > n.max!) errs.push(`stats[${idx}] min > max`);
    }
    if (s.type === "enum") {
      const e = s as StatsEnum;
      if (Array.isArray(e.options)) {
        if (e.options.length > 25) errs.push(`stats[${idx}] excede o limite de 25 opções (${e.options.length})`);
        const seen = new Set<number>();
        e.options.forEach((o, j) => {
          if (seen.has(o.value)) errs.push(`stats[${idx}].options[${j}].value duplicado: ${o.value}`);
          seen.add(o.value);
          if (!o.name?.default) errs.push(`stats[${idx}].options[${j}].name.default é obrigatório`);
        });
      }
    }
    if (s.type === "calculated") {
      const c = s as StatsCalculated; 
      if (!c.formula) errs.push(`stats[${idx}].formula é obrigatório`);
      
      // Verificar se há dependências circulares
      if (c.formula && hasCircularDependency(c.id, c.formula, system.stats)) {
        errs.push(`stats[${idx}] tem dependência circular na fórmula`);
      }
      
      // Verificar se as variáveis referenciadas existem
      const dependencies = findStatDependencies(c.formula);
      dependencies.forEach(depId => {
        const depStat = system.stats.find(s => s.id === depId);
        if (!depStat) {
          errs.push(`stats[${idx}].formula referencia stat inexistente: ${depId}`);
        } else if (depStat.type === 'string') {
          errs.push(`stats[${idx}].formula referencia stat do tipo string: ${depId}`);
        }
      });
    }
  });

  const secIds = new Set<number>();
  system.sections.forEach((sec, i) => {
    if (secIds.has(sec.id)) errs.push(`sections[${i}] id duplicado: ${sec.id}`);
    secIds.add(sec.id);
    if (!sec.name?.default) errs.push(`sections[${i}].name.default é obrigatório`);
    if (!sec.preview?.type) errs.push(`sections[${i}].preview.type é obrigatório`);
  });
  return errs;
}

// =====================
// Main Component
// =====================
export default function RPGSystemBuilder(){
  const [system, setSystem] = useState<RPGSystem>({
    config: { id: 1, name: { default: "Meu Sistema" }, description: { default: "Descrição breve do sistema." } },
    stats: [
      { id: 1, type: "numeric", name: { default: "Força" }, min: 0, max: 10 },
      { id: 2, type: "boolean", name: { default: "Treinado em Furtividade" } },
      { id: 3, type: "enum", name: { default: "Classe" }, options: [] },
    ],
    sections: [
      { id: 1, name: { default: "Resumo" }, quick_edit_btn: true, preview: { type: "string", content: { default: "Um **pequeno** resumo do personagem." } }, view_pages: [1] },
      { id: 2, name: { default: "Atributos" }, quick_edit_btn: true, preview: { type: "string", content: { default: "Lista de atributos..." } }, view_pages: [1,2] },
    ],
    integrations: {
      schemas: []
    },
  });
  const [selectedTab, setSelectedTab] = useState<string>("config");
  const errors = useMemo(()=>validate(system),[system]);

  const addStat=(kind:Stats["type"])=>{
    const id = nextId(system.stats); const base = { id, name: { default: "Novo Stat" } } as BaseStat; let stat:Stats;
    switch(kind){
      case "numeric": stat={...base, type:"numeric", min:0, max:10} as StatsNumeric; break;
      case "enum": stat={...base, type:"enum", options:[]} as StatsEnum; break;
      case "boolean": stat={...base, type:"boolean"} as StatsBoolean; break;
      case "string": stat={...base, type:"string", minLength:0, maxLength:200} as StatsString; break;
      case "calculated": stat={...base, type:"calculated", formula:""} as StatsCalculated; break;
    }
    setSystem({ ...system, stats:[...system.stats, stat] }); setSelectedTab("stats");
  };
  const updateStat=(index:number, v:Stats)=>{ const copy=clone(system); copy.stats[index]=v; setSystem(copy); };
  const removeStat=(index:number)=>{ const copy=clone(system); copy.stats.splice(index,1); setSystem(copy); };
  const duplicateStat=(index:number)=>{ 
    const copy=clone(system); 
    const originalStat = copy.stats[index];
    const newId = nextId(copy.stats);
    const duplicatedStat = {
      ...originalStat,
      id: newId,
      name: {
        ...originalStat.name,
        default: `${originalStat.name?.default || 'Stat'} (Cópia)`
      }
    };
    copy.stats.splice(index + 1, 0, duplicatedStat);
    setSystem(copy); 
  };
  const moveStat=(index:number, dir:-1|1)=>{ const copy=clone(system); const j=index+dir; if(j<0||j>=copy.stats.length) return; const tmp=copy.stats[index]; copy.stats[index]=copy.stats[j]; copy.stats[j]=tmp; setSystem(copy); };

  const addSection=()=>{ setSystem({ ...system, sections:[ ...system.sections, { id: nextId(system.sections), name:{ default:"Nova Seção" }, quick_edit_btn:false, preview:{ type:"string", content:{ default:"" } }, view_pages:[] } ] }); setSelectedTab("sections"); };
  const updateSection=(index:number,v:Section)=>{ const copy=clone(system); copy.sections[index]=v; setSystem(copy); };
  const removeSection=(index:number)=>{ const copy=clone(system); copy.sections.splice(index,1); setSystem(copy); };
  const moveSection=(index:number, dir:-1|1)=>{ const copy=clone(system); const j=index+dir; if(j<0||j>=copy.sections.length) return; const tmp=copy.sections[index]; copy.sections[index]=copy.sections[j]; copy.sections[j]=tmp; setSystem(copy); };

  const exportJson=()=>{ const text=JSON.stringify(system, null, 2); download(`rpg-system-${system.config.name.default || system.config.id}.json`, text); };
  const fileRef = useRef<HTMLInputElement|null>(null);
  const importJson=(file:File)=>{ const reader=new FileReader(); reader.onload=()=>{ try{ const parsed=JSON.parse(String(reader.result)); setSystem(parsed); toast.success("Importado com sucesso!"); } catch{ toast.error("Falha ao importar JSON"); } }; reader.readAsText(file); };
  const copyJson=async()=>{ try{ await navigator.clipboard.writeText(JSON.stringify(system,null,2)); toast.success("JSON copiado para a área de transferência"); } catch{ toast.error("Não foi possível copiar o JSON"); } };

  return (
    <div className="p-6 max-w-[1200px] mx-auto grid gap-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">RPG System Builder</h1><p className="text-sm text-muted-foreground">Ferramenta visual para criar sistemas compatíveis com seu schema.</p></div>
        <div className="flex gap-2">
          <Button onClick={exportJson}><Download className="h-4 w-4 mr-2"/> Exportar JSON</Button>
          <Button variant="outline" onClick={copyJson}><Copy className="h-4 w-4 mr-2"/> Copiar JSON</Button>
          <Button variant="outline" onClick={()=>fileRef.current?.click()}><Upload className="h-4 w-4 mr-2"/> Importar JSON</Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e)=> e.target.files && importJson(e.target.files[0])}/>
        </div>
      </div>

      {errors.length>0 && (
        <Card className="border-red-500/40"><CardHeader className="py-3"><CardTitle className="text-sm">Validação</CardTitle></CardHeader>
          <CardContent className="grid gap-1">{errors.map((er,i)=>(<div key={i} className="text-sm text-red-500">• {er}</div>))}</CardContent>
        </Card>
      )}

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="sections">Seções</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-4">
          <ConfigTab
            value={system.config}
            onChange={(v) => setSystem({ ...system, config: v })}
            LabelLocalizationEditor={LabelLocalizationEditor}
            CompactTextLocalizationEditor={CompactTextLocalizationEditor}
          />
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <StatsTab
            stats={system.stats as any}
            sections={system.sections as any}
            onAddStat={addStat}
            onUpdateStat={updateStat}
            onRemoveStat={removeStat}
            onDuplicateStat={duplicateStat}
            onMoveStat={moveStat}
            PolymorphicStatEditor={PolymorphicStatEditor as any}
          />
        </TabsContent>

        <TabsContent value="sections" className="mt-4">
          <SectionsTab
            sections={system.sections as any}
            stats={system.stats as any}
            onAddSection={addSection}
            onUpdateSection={updateSection}
            onRemoveSection={removeSection}
            onMoveSection={moveSection}
            SectionEditor={SectionEditor as any}
          />
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <IntegrationsTab
            integrations={system.integrations}
            stats={system.stats}
            onUpdateIntegrations={(integrations) => setSystem({ ...system, integrations })}
            LabelLocalizationEditor={LabelLocalizationEditor}
            CompactTextLocalizationEditor={CompactTextLocalizationEditor}
            MathExpressionEditor={MathExpressionEditor}
            DiceNotationEditor={DiceNotationEditor}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <PreviewTab system={system as any} />
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground text-center py-4">Feito com ❤️ para construir schemas que você pode salvar e usar no seu bot.</div>
    </div>
  );
}