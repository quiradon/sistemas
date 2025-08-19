export declare enum Locale {
    Indonesian = "id",
    EnglishUS = "en-US",
    EnglishGB = "en-GB",
    Bulgarian = "bg",
    ChineseCN = "zh-CN",
    ChineseTW = "zh-TW",
    Croatian = "hr",
    Czech = "cs",
    Danish = "da",
    Dutch = "nl",
    Finnish = "fi",
    French = "fr",
    German = "de",
    Greek = "el",
    Hindi = "hi",
    Hungarian = "hu",
    Italian = "it",
    Japanese = "ja",
    Korean = "ko",
    Lithuanian = "lt",
    Norwegian = "no",
    Polish = "pl",
    PortugueseBR = "pt-BR",
    Romanian = "ro",
    Russian = "ru",
    SpanishES = "es-ES",
    SpanishLATAM = "es-419",
    Swedish = "sv-SE",
    Thai = "th",
    Turkish = "tr",
    Ukrainian = "uk",
    Vietnamese = "vi"
}
/**
 * @deprecated Use {@link Locale} instead.
 */
export type LocaleString = `${Locale}`;

/**
 * Localized value: has a default plus optionally other locales.
 */
 type Localization<T = string> = { default: T } & Partial<Record<Locale, T>>;

/**
 * Marca forte para labels curtos (opcional, mantendo convensão do projeto).
 */
 type LabelString = string & { __brand_label100?: true };

/**
 * Localized label that uses LabelString type for values.
 */
export type LabelLocalization = { default: LabelString } & Partial<Record<Locale, LabelString>>;

/**
 * Base comum para todos os stats: id, nome, emoji e um comentário/descritivo localizável.
 * O campo `comment` é um texto livre (pode conter instruções, descrições, dicas).
 */
interface BaseStat {
    id: number;
    name: LabelLocalization;
    edit_page?: number[]; // Páginas onde o stat pode ser editado
    emoji?: string;
}

/**
 * Representa um stat numérico (força, destreza, etc.)
 */
interface StatsNumeric extends BaseStat {
    type: "numeric";
    min?: number;
    max?: number;
}

/**
 * Representa opções enumeradas.
 * `options` pode ser:
 * - array de strings (valores curtos),
 * - array de objetos (valor + nome localizável + emoji + comment),
 * - ou um número (por compatibilidade com schema externo).
 */
interface StatsEnumOption {
    value: number;
    name: LabelLocalization;
    edit_page?: number[]
    emoji?: string;
    replacements?: Replacement[];
}

interface StatsEnum extends BaseStat {
    type: "enum";
    options: StatsEnumOption[] | number;
    dices?: Dice[];
    replacements?: Replacement[];
}

/**
 * Estado booleano.
 */
interface StatsBoolean extends BaseStat {
    type: "boolean";
}

/**
 * Texto livre com limites opcionais.
 */
interface StatsString extends BaseStat {
    type: "string";
    maxLength?: number;
    minLength?: number;
}

/**
 * Stat calculado a partir de fórmula (string) e dependências (ids ou keys).
 */
interface StatsCalculated extends BaseStat {
    type: "calculated";
    formula: string;
    dices?: Dice[];
    replacements?: Replacement[];
}

interface Replacement {
    key: number; // Chave de substituição
    options: number[];
}

/**
 * Entrada que representa um componente/visualização customizada (ex.: extras de dados).
 * `props` pode ser qualquer objeto serializável e `comment` descreve o propósito do componente.
 */


/**
 * União de todos os tipos de stat possíveis
 */
type Stats = StatsNumeric | StatsEnum | StatsBoolean | StatsString | StatsCalculated 
/**
 * Sistema de RPG contendo config, lista de stats e seções.
 */
export interface RPGSystem {
    config: {
        id: number;
        name: LabelLocalization;
        description: Localization<string>;
    };
    stats: Stats[];
        sections: Section[];
}

interface Section {
    id: number;
    name: LabelLocalization;
    quick_edit_btn: boolean;
    emoji?: string; 
    preview: {
        type: "string" | "img";
        content: Localization<string>;
    };
    view_pages: number[]; // Páginas em que o conteúdo é exibido
}

interface Dice{
    expression: string; 
    condition?: {
        value1: string;
        operator: "<" | ">" | "<=" | ">=" | "==" | "!=";
        value2: string;
    }
}

