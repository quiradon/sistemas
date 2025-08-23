import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { evaluate } from "mathjs";

// Types - definição compatível com o editor principal
interface Stats {
  id: number;
  type: string;
  emoji?: string;
  name?: { default: string };
  min?: number;
  options?: number | any[]; // Permitir ambos os tipos para compatibilidade
}

interface MathExpressionEditorProps {
  value: string;
  onChange: (v: string) => void;
  stats?: Stats[];
  onConfirm?: (expression: string) => void;
}

const MathExpressionEditor: React.FC<MathExpressionEditorProps> = ({
  value,
  onChange,
  stats = [],
  onConfirm,
}) => {
  const [expression, setExpression] = useState(value);
  const [showVariables, setShowVariables] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filtrar apenas stats que podem ser usados em cálculos (não string)
  const mathCompatibleStats = stats.filter(
    (stat) =>
      stat.type === "numeric" ||
      stat.type === "boolean" ||
      stat.type === "enum" ||
      stat.type === "calculated"
  );

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

  const insertOperator = (operator: string) => {
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

  const insertFunction = (func: string) => {
    const functionText = `${func}(`;

    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Inserir a função na posição do cursor
      const newValue =
        expression.slice(0, start) + functionText + expression.slice(end);
      setExpression(newValue);

      // Reposicionar cursor dentro dos parênteses
      setTimeout(() => {
        const newCursorPos = start + functionText.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    } else {
      // Fallback: adicionar no final
      setExpression((prev) => prev + functionText);
    }
  };

  const handleConfirm = () => {
    onChange(expression);
    onConfirm?.(expression);
  };

  // Funções matemáticas disponíveis
  const mathFunctions = [
    { name: "abs", label: "abs(x)", desc: "Valor absoluto" },
    { name: "sqrt", label: "sqrt(x)", desc: "Raiz quadrada" },
    { name: "pow", label: "pow(x,y)", desc: "Potência x^y" },
    { name: "floor", label: "floor(x)", desc: "Arredondar para baixo" },
    { name: "ceil", label: "ceil(x)", desc: "Arredondar para cima" },
    { name: "round", label: "round(x)", desc: "Arredondar" },
    { name: "min", label: "min(a,b)", desc: "Mínimo" },
    { name: "max", label: "max(a,b)", desc: "Máximo" },
  ];

  const operators = [
    { symbol: "+", label: "Soma" },
    { symbol: "-", label: "Subtração" },
    { symbol: "*", label: "Multiplicação" },
    { symbol: "/", label: "Divisão" },
    { symbol: "^", label: "Potência" },
    { symbol: "%", label: "Módulo" },
    { symbol: "(", label: "Abre parênteses" },
    { symbol: ")", label: "Fecha parênteses" },
  ];

  return (
    <Card className="border-dashed">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          Editor de Expressão Matemática
          <Badge variant="secondary">math.js</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {/* Campo de entrada */}
        <div className="grid gap-2">
          <Label>Expressão</Label>
          <Textarea
            ref={textareaRef}
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="Digite sua expressão matemática..."
            className="font-mono text-sm"
            rows={3}
          />
        </div>

        {/* Operadores básicos */}
        <div className="grid gap-2">
          <Label>Operadores</Label>
          <div className="flex flex-wrap gap-1">
            {operators.map((op) => (
              <Button
                key={op.symbol}
                variant="outline"
                size="sm"
                onClick={() => insertOperator(op.symbol)}
                title={op.label}
                className="h-8 px-2"
              >
                {op.symbol}
              </Button>
            ))}
          </div>
        </div>

        {/* Funções matemáticas */}
        <div className="grid gap-2">
          <Label>Funções Matemáticas</Label>
          <ScrollArea className="h-32 border rounded-md p-2">
            <div className="grid grid-cols-2 gap-1">
              {mathFunctions.map((func) => (
                <Button
                  key={func.name}
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFunction(func.name)}
                  className="justify-start h-auto p-2 text-left"
                  title={func.desc}
                >
                  <div>
                    <div className="font-mono text-xs">{func.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {func.desc}
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
            <Label>Variáveis (Não-String)</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVariables(!showVariables)}
            >
              {showVariables ? "Ocultar" : "Mostrar"} (
              {mathCompatibleStats.length})
            </Button>
          </div>

          {showVariables && (
            <ScrollArea className="h-32 border rounded-md p-2">
              {mathCompatibleStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma variável compatível encontrada.
                </p>
              ) : (
                <div className="space-y-1">
                  {mathCompatibleStats.map((stat) => (
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
                  Resultado (com valores de exemplo):
                </div>
                <div className="text-green-600">
                  {(() => {
                    try {
                      // Substituir variáveis por valores de exemplo para preview
                      const previewExpression = expression.replace(
                        /<stat:(\d+):value>/g,
                        (_, id) => {
                          const stat = stats.find((s) => s.id === parseInt(id));
                          if (!stat) return "1";
                          switch (stat.type) {
                            case "numeric":
                              return String(stat.min || 1);
                            case "boolean":
                              return "0";
                            case "enum":
                              if (Array.isArray(stat.options) && stat.options.length > 0) {
                                return String(stat.options[0].value || stat.options[0]);
                              }
                              return "1";
                            default:
                              return "1";
                          }
                        }
                      );
                      const result = evaluate(previewExpression);
                      // Garantir que o resultado seja sempre uma string
                      return typeof result === "object"
                        ? JSON.stringify(result)
                        : String(result);
                    } catch {
                      return "[Expressão inválida]";
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

export default MathExpressionEditor;