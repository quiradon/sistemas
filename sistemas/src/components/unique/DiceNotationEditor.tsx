import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { DiceRoll } from "@dice-roller/rpg-dice-roller";

// Types - definição compatível com o editor principal
interface Stats {
  id: number;
  type: string;
  emoji?: string;
  name?: { default: string };
  min?: number;
  options?: number | any[]; // Permitir ambos os tipos para compatibilidade
}

interface DiceNotationEditorProps {
  value: string;
  onChange: (value: string) => void;
  stats?: Stats[];
  onConfirm?: (expression: string) => void;
}

const DiceNotationEditor: React.FC<DiceNotationEditorProps> = ({
  value,
  onChange,
  stats = [],
  onConfirm,
}) => {
  const [expression, setExpression] = useState(value);
  const [showVariables, setShowVariables] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filtrar apenas stats que podem ser usados em dados (não string)
  const diceCompatibleStats = stats.filter(
    (stat) =>
      stat.type === "numeric" ||
      stat.type === "boolean" ||
      stat.type === "enum" ||
      stat.type === "calculated"
  );

  // Filtrar stats baseado na busca
  const filteredStats = diceCompatibleStats.filter(stat => {
    if (!searchFilter.trim()) return true;
    
    const searchTerm = searchFilter.toLowerCase();
    const statName = (stat.name?.default || '').toLowerCase();
    const statType = stat.type.toLowerCase();
    const statId = stat.id.toString();
    
    return statName.includes(searchTerm) || 
           statType.includes(searchTerm) || 
           statId.includes(searchTerm);
  });

  const insertVariable = (statId: number) => {
    const variableText = `<stat:${statId}:value>`;

    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Inserir o texto na posição do cursor
      const newValue =
        expression.slice(0, start) + variableText + expression.slice(end);
      setExpression(newValue);

      // Reposicionar cursor após a variável inserida
      setTimeout(() => {
        const newCursorPos = start + variableText.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    } else {
      // Fallback: adicionar no final
      setExpression((prev) => prev + variableText);
    }

    setShowVariables(false);
  };

  const insertDiceOperator = (operator: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Inserir o operador na posição do cursor
      const newValue =
        expression.slice(0, start) + operator + expression.slice(end);
      setExpression(newValue);

      // Reposicionar cursor após o operador
      setTimeout(() => {
        const newCursorPos = start + operator.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    } else {
      // Fallback: adicionar no final
      setExpression((prev) => prev + operator);
    }
  };

  const handleConfirm = () => {
    onChange(expression);
    onConfirm?.(expression);
  };

  // Operadores e dados comuns
  const diceOperators = [
    { symbol: "+", label: "Soma" },
    { symbol: "-", label: "Subtração" },
    { symbol: "*", label: "Multiplicação" },
    { symbol: "/", label: "Divisão" },
    { symbol: "(", label: "Abre parênteses" },
    { symbol: ")", label: "Fecha parênteses" },
  ];

  const commonDice = [
    { notation: "1d4", label: "D4" },
    { notation: "1d6", label: "D6" },
    { notation: "1d8", label: "D8" },
    { notation: "1d10", label: "D10" },
    { notation: "1d12", label: "D12" },
    { notation: "1d20", label: "D20" },
    { notation: "1d100", label: "D100" },
    { notation: "2d6", label: "2D6" },
    { notation: "3d6", label: "3D6" },
    { notation: "4d6", label: "4D6" },
  ];

  const diceModifiers = [
    { notation: "kh1", label: "kh1 (keep highest 1)", desc: "Manter o maior valor" },
    { notation: "kl1", label: "kl1 (keep lowest 1)", desc: "Manter o menor valor" },
    { notation: "dh1", label: "dh1 (drop highest 1)", desc: "Descartar o maior valor" },
    { notation: "dl1", label: "dl1 (drop lowest 1)", desc: "Descartar o menor valor" },
    { notation: "r1", label: "r1 (reroll 1s)", desc: "Re-rolar valores 1" },
    { notation: "x", label: "x (explode)", desc: "Explodir no máximo" },
    { notation: "!", label: "! (explode)", desc: "Explodir no máximo" },
    { notation: "!!", label: "!! (compound)", desc: "Explosão composta" },
    { notation: "!p", label: "!p (penetrating)", desc: "Explosão penetrante" },
    { notation: "min1", label: "min1", desc: "Valor mínimo 1" },
    { notation: "max20", label: "max20", desc: "Valor máximo 20" },
    { notation: "cs>15", label: "cs>15 (count success)", desc: "Contar sucessos >15" },
    { notation: "cf<5", label: "cf<5 (count failures)", desc: "Contar falhas <5" },
    { notation: "sa", label: "sa (sort ascending)", desc: "Ordenar crescente" },
    { notation: "sd", label: "sd (sort descending)", desc: "Ordenar decrescente" },
    { notation: "u", label: "u (unique)", desc: "Valores únicos" },
  ];

  return (
    <Card className="border-dashed">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          Editor de Dice Notation
          <Badge variant="secondary">D&D Style</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {/* Campo de entrada */}
        <div className="grid gap-2">
          <Label>Expressão de Dados</Label>
          <Textarea
            ref={textareaRef}
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="Ex: 1d20 + <stat:1:value>"
            className="font-mono text-sm"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Use notação padrão: 1d20, 2d6+3, 4d6kh3, etc. Adicione variáveis
            clicando abaixo.
          </p>
        </div>

        {/* Dados Comuns */}
        <div className="grid gap-2">
          <Label>Dados Comuns</Label>
          <div className="flex flex-wrap gap-1">
            {commonDice.map((dice) => (
              <Button
                key={dice.notation}
                variant="outline"
                size="sm"
                onClick={() => insertDiceOperator(dice.notation)}
                className="h-8 px-2"
              >
                {dice.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Operadores */}
        <div className="grid gap-2">
          <Label>Operadores</Label>
          <div className="flex flex-wrap gap-1">
            {diceOperators.map((op) => (
              <Button
                key={op.symbol}
                variant="outline"
                size="sm"
                onClick={() => insertDiceOperator(op.symbol)}
                title={op.label}
                className="h-8 px-2"
              >
                {op.symbol}
              </Button>
            ))}
          </div>
        </div>

        {/* Modificadores Avançados */}
        <div className="grid gap-2">
          <Label>Modificadores Avançados</Label>
          <ScrollArea className="h-24 border rounded-md p-2">
            <div className="grid grid-cols-2 gap-1">
              {diceModifiers.map((mod) => (
                <Button
                  key={mod.notation}
                  variant="ghost"
                  size="sm"
                  onClick={() => insertDiceOperator(mod.notation)}
                  className="justify-start h-auto p-2 text-left"
                  title={mod.desc}
                >
                  <div>
                    <div className="font-mono text-xs">{mod.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {mod.desc}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Variáveis disponíveis */}
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>
              Variáveis ({diceCompatibleStats.length} disponíveis{searchFilter ? ` • ${filteredStats.length} exibidos` : ''})
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVariables(!showVariables)}
            >
              {showVariables ? "Ocultar" : "Mostrar"} (
              {diceCompatibleStats.length})
            </Button>
          </div>

          {showVariables && (
            <div className="space-y-2">
              {/* Campo de busca */}
              <div className="relative">
                <Input
                  placeholder="Buscar variáveis por nome, tipo ou ID..."
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
                {filteredStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {searchFilter ? 
                      `Nenhuma variável encontrada para "${searchFilter}"` :
                      "Nenhuma variável compatível encontrada."
                    }
                  </p>
                ) : (
                  <div className="space-y-1">
                    {filteredStats.map((stat) => (
                    <Button
                      key={stat.id}
                      variant="ghost"
                      size="sm"
                      onClick={() => insertVariable(stat.id)}
                      className="w-full justify-start h-auto p-2 text-left"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Badge variant="secondary">{stat.type}</Badge>
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {stat.emoji && `${stat.emoji} `}
                            {stat.name?.default || `Stat ${stat.id}`}
                          </div>
                          <code className="text-xs bg-muted px-1 rounded">
                            &lt;stat:{stat.id}:value&gt;
                          </code>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </ScrollArea>
            </div>
          )}
        </div>

        {/* Preview do resultado */}
        <div className="grid gap-2">
          <Label>Preview</Label>
          <div className="bg-muted p-3 rounded-md font-mono text-sm">
            {expression ? (
              <>
                <div className="text-muted-foreground mb-1">Expressão:</div>
                <div className="mb-2">{expression}</div>
                <div className="text-muted-foreground mb-1">
                  Com valores exemplo:
                </div>
                <div className="text-blue-600">
                  {(() => {
                    try {
                      // Substituir variáveis por valores de exemplo para preview
                      const previewExpression = expression.replace(
                        /<stat:(\d+):value>/g,
                        (_, id) => {
                          const stat = stats.find((s) => s.id === parseInt(id));
                          if (!stat) return "3";
                          switch (stat.type) {
                            case "numeric":
                              return String(stat.min || 3);
                            case "boolean":
                              return "1";
                            case "enum":
                              if (
                                Array.isArray(stat.options) &&
                                stat.options.length > 0
                              ) {
                                return String(stat.options[0].value || stat.options[0]);
                              }
                              return "2";
                            default:
                              return "3";
                          }
                        }
                      );

                      // Usar DiceRoll para validar e testar a expressão
                      const roll = new DiceRoll(previewExpression);
                      return `${previewExpression} → ${roll.output}`;
                    } catch (error) {
                      return `[Erro: ${
                        error instanceof Error ? error.message : "Expressão inválida"
                      }]`;
                    }
                  })()}
                </div>
              </>
            ) : (
              <span className="text-muted-foreground">
                Digite uma expressão para ver o preview
              </span>
            )}
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setExpression("")}>
            Limpar
          </Button>
          <Button onClick={handleConfirm}>Confirmar</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DiceNotationEditor;