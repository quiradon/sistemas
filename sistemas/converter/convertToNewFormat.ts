import { readFileSync, writeFileSync } from 'fs';
import { RPGSystem, Locale } from './systemTypes';

// Tipos do formato antigo
interface OldFormat {
    i18n: {
        [locale: string]: {
            commands: {
                config: {
                    label: string;
                    description: string;
                };
                ficha: {
                    fields: Array<{
                        value: string;
                        forMenu: number[];
                    }>;
                };
            };
            stats: Record<string, string>;
            enums: Array<{
                for: number[];
                enum: Array<{
                    value: number;
                    name: string;
                }>;
            }>;
            menu: Record<string, string>;
        };
    };
    commands: {
        config: {
            emoji: string;
            value: number;
        };
        menu: Record<string, {
            style: number;
            emoji: string;
        }>;
    };
    integrations: Record<string, any>;
    stats: Array<{
        id: number;
        emoji?: string;
        menu?: number;
        canHoldValue?: boolean;
        dices?: Array<{
            dice: string;
        }>;
        enum?: Array<{
            value: number;
            emoji?: string;
        }>;
        replacements?: Array<{
            id: number;
            menu: number;
            replacedBy: number[];
        }>;
    }>;
}

// Mapeamento de locales do formato antigo para o novo
const localeMapping: Record<string, Locale> = {
    'default': Locale.EnglishUS,
    'pt-BR': Locale.PortugueseBR,
    'fr': Locale.French,
    'ko': Locale.Korean,
};

function convertToNewFormat(oldData: OldFormat): RPGSystem {
    // Extrair informações básicas do sistema
    const defaultLocale = oldData.i18n.default || oldData.i18n[Object.keys(oldData.i18n)[0]];
    
    // Configuração do sistema
    const config = {
        id: oldData.commands.config.value,
        name: {
            default: defaultLocale.commands.config.label
        } as any,
        description: {
            default: defaultLocale.commands.config.description
        } as any
    };

    // Adicionar traduções para name e description
    Object.keys(oldData.i18n).forEach(oldLocale => {
        const locale = localeMapping[oldLocale];
        if (locale && locale !== Locale.EnglishUS) {
            config.name[locale] = oldData.i18n[oldLocale].commands.config.label;
            config.description[locale] = oldData.i18n[oldLocale].commands.config.description;
        }
    });

    // Converter stats
    const stats = oldData.stats.map(oldStat => {
        const statName = {
            default: defaultLocale.stats[oldStat.id.toString()] || `Stat ${oldStat.id}`
        } as any;

        // Adicionar traduções do nome
        Object.keys(oldData.i18n).forEach(oldLocale => {
            const locale = localeMapping[oldLocale];
            if (locale && locale !== Locale.EnglishUS) {
                const translatedName = oldData.i18n[oldLocale].stats[oldStat.id.toString()];
                if (translatedName) {
                    statName[locale] = translatedName;
                }
            }
        });

        const baseStat = {
            id: oldStat.id,
            name: statName,
            emoji: oldStat.emoji,
            edit_page: oldStat.menu !== undefined ? [oldStat.menu] : undefined
        };

        // Determinar o tipo do stat baseado nas propriedades
        if (oldStat.enum) {
            // Stat do tipo enum
            const options = oldStat.enum.map(enumOption => {
                const optionName = {
                    default: enumOption.value.toString() // Fallback básico
                } as any;

                // Buscar nomes das opções nos enums do i18n
                Object.keys(oldData.i18n).forEach(oldLocale => {
                    const locale = localeMapping[oldLocale];
                    const enumDef = oldData.i18n[oldLocale].enums?.find(e => 
                        e.for.includes(oldStat.id)
                    );
                    
                    if (enumDef) {
                        const enumOptionDef = enumDef.enum.find(e => e.value === enumOption.value);
                        if (enumOptionDef) {
                            if (locale === Locale.EnglishUS || oldLocale === 'default') {
                                optionName.default = enumOptionDef.name;
                            } else if (locale) {
                                optionName[locale] = enumOptionDef.name;
                            }
                        }
                    }
                });

                return {
                    value: enumOption.value,
                    name: optionName,
                    emoji: enumOption.emoji,
                    edit_page: oldStat.menu !== undefined ? [oldStat.menu] : undefined,
                    replacements: oldStat.replacements?.map(r => ({
                        key: r.id,
                        options: r.replacedBy
                    }))
                };
            });

            return {
                ...baseStat,
                type: 'enum' as const,
                options,
                dices: oldStat.dices?.map(d => ({
                    expression: d.dice
                })),
                replacements: oldStat.replacements?.map(r => ({
                    key: r.id,
                    options: r.replacedBy
                }))
            };
        } else if (oldStat.dices && oldStat.dices.length > 0) {
            // Stat calculado (tem dices mas não enum)
            return {
                ...baseStat,
                type: 'calculated' as const,
                formula: oldStat.dices[0].dice, // Usar o primeiro dice como fórmula
                dices: oldStat.dices.map(d => ({
                    expression: d.dice
                }))
            };
        } else if (oldStat.canHoldValue === false) {
            // Stat booleano (não pode ter valor)
            return {
                ...baseStat,
                type: 'boolean' as const
            };
        } else {
            // Stat numérico (padrão)
            return {
                ...baseStat,
                type: 'numeric' as const
            };
        }
    });

    // Converter seções (baseado nos menus)
    const sections = Object.keys(defaultLocale.menu).map(menuId => {
        const sectionName = {
            default: defaultLocale.menu[menuId]
        } as any;

        // Adicionar traduções do nome da seção
        Object.keys(oldData.i18n).forEach(oldLocale => {
            const locale = localeMapping[oldLocale];
            if (locale && locale !== Locale.EnglishUS) {
                const translatedName = oldData.i18n[oldLocale].menu[menuId];
                if (translatedName) {
                    sectionName[locale] = translatedName;
                }
            }
        });

        // Encontrar o campo correspondente em ficha.fields
        const field = defaultLocale.commands.ficha.fields.find(f => 
            f.forMenu.includes(parseInt(menuId))
        );

        const previewContent = {
            default: field?.value || `Section ${menuId}`
        } as any;

        // Adicionar traduções do conteúdo de preview
        Object.keys(oldData.i18n).forEach(oldLocale => {
            const locale = localeMapping[oldLocale];
            if (locale && locale !== Locale.EnglishUS) {
                const translatedField = oldData.i18n[oldLocale].commands.ficha.fields.find(f => 
                    f.forMenu.includes(parseInt(menuId))
                );
                if (translatedField) {
                    previewContent[locale] = translatedField.value;
                }
            }
        });

        return {
            id: parseInt(menuId),
            name: sectionName,
            quick_edit_btn: true,
            emoji: oldData.commands.menu[menuId]?.emoji,
            preview: {
                type: 'string' as const,
                content: previewContent
            },
            view_pages: [parseInt(menuId)]
        };
    });

    return {
        config,
        stats,
        sections
    };
}

// Função principal para executar a conversão
function main() {
    try {
        console.log('Iniciando conversão do formato antigo para o novo...');
        
        // Ler o arquivo JSON antigo
        const oldJsonPath = './oldJson.json';
        const oldJsonContent = readFileSync(oldJsonPath, 'utf-8');
        const oldData: OldFormat = JSON.parse(oldJsonContent);
        
        console.log('JSON antigo carregado com sucesso.');
        
        // Converter para o novo formato
        const newData = convertToNewFormat(oldData);
        
        console.log('Conversão concluída.');
        
        // Salvar o novo formato
        const newJsonPath = './newFormat.json';
        writeFileSync(newJsonPath, JSON.stringify(newData, null, 2), 'utf-8');
        
        console.log(`Novo formato salvo em: ${newJsonPath}`);
        console.log('\nResumo da conversão:');
        console.log(`- Sistema: ${newData.config.name.default}`);
        console.log(`- Stats convertidos: ${newData.stats.length}`);
        console.log(`- Seções criadas: ${newData.sections.length}`);
        
    } catch (error) {
        console.error('Erro durante a conversão:', error);
        process.exit(1);
    }
}

// Executar se for chamado diretamente
if (require.main === module) {
    main();
}

export { convertToNewFormat, main };