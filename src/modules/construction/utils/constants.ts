
import { ServicePrice, TrechoMapping, SupervisaoMapping } from '../types';

export const EQUIPMENT_CATEGORIES: Record<string, string> = {
    "EH": "Escavadeira Hidráulica",
    "CB": "Caminhão Basculante",
    "CBL": "Caminhão Basculante",
    "MN": "Motoniveladora",
    "PC": "Pá Carregadeira",
    "RE": "Retroescavadeira",
    "REL": "Retroescavadeira",
    "MEL": "Miniescavadeira",
    "VLL": "Veículo Leve",
    "CM": "Cavalo Mecânico"
};

export const TRECHO_MAPPINGS: TrechoMapping[] = [
    { "km_inicial": 0.001, "km_final": 16, "cidade": "Açailândia", "trecho": "T-01" },
    { "km_inicial": 16.001, "km_final": 44, "cidade": "S.F. Brejão", "trecho": "T-01" },
    { "km_inicial": 44.001, "km_final": 78, "cidade": "João Lisboa", "trecho": "T-01" },
    { "km_inicial": 78.001, "km_final": 96.397, "cidade": "Imperatriz", "trecho": "T-01" },
    { "km_inicial": 96.398, "km_final": 122.82, "cidade": "Edson Lobão", "trecho": "T-01" },
    { "km_inicial": 122.821, "km_final": 152.303, "cidade": "Ribamar Fiquene", "trecho": "T-01" },
    { "km_inicial": 152.304, "km_final": 172.403, "cidade": "Campestre", "trecho": "T-01" },
    { "km_inicial": 172.404, "km_final": 195, "cidade": "Porto Franco", "trecho": "T-01" },
    { "km_inicial": 195.1, "km_final": 213.603, "cidade": "Estreito", "trecho": "T-02" },
    { "km_inicial": 213.604, "km_final": 218.976, "cidade": "Aguiarnópolis", "trecho": "T-02" },
    { "km_inicial": 218.977, "km_final": 253.5, "cidade": "Palmeiras Do", "trecho": "T-02" },
    { "km_inicial": 253.501, "km_final": 274.15, "cidade": "Darcinópolis", "trecho": "T-02" },
    { "km_inicial": 274.151, "km_final": 299.999, "cidade": "Babaçulândia", "trecho": "T-02" },
    { "km_inicial": 300, "km_final": 300, "cidade": "São Luís", "trecho": "T-04" },
    { "km_inicial": 300.001, "km_final": 356.619, "cidade": "Babaçulândia", "trecho": "T-02" },
    { "km_inicial": 356.62, "km_final": 385.4, "cidade": "Araguaína", "trecho": "T-02" },
    { "km_inicial": 385.4, "km_final": 465.4, "cidade": "Palmeirante", "trecho": "T-02" },
    { "km_inicial": 465.401, "km_final": 520.455, "cidade": "Tupiratins", "trecho": "T-03" },
    { "km_inicial": 520.456, "km_final": 536.741, "cidade": "Guaraí", "trecho": "T-03" },
    { "km_inicial": 536.742, "km_final": 580.293, "cidade": "Tupirama", "trecho": "T-03" },
    { "km_inicial": 580.294, "km_final": 608.637, "cidade": "Rio Dos Bois", "trecho": "T-03" },
    { "km_inicial": 608.638, "km_final": 698.981, "cidade": "Miracema", "trecho": "T-03" },
    { "km_inicial": 698.982, "km_final": 735.6, "cidade": "Porto Nacional", "trecho": "T-03" },
    { "km_inicial": 900, "km_final": 902, "cidade": "Eng. VLI", "trecho": "T-04" }
];

export const SUPERVISAO_MAPPINGS: SupervisaoMapping[] = [
    { "trecho": "T-01", "supervisao": "Imperatriz" },
    { "trecho": "T-02", "supervisao": "Araguaina" },
    { "trecho": "T-03", "supervisao": "Palmas" },
    { "trecho": "T-04", "supervisao": "São Luis" },
    { "trecho": "VLI", "supervisao": "VLI - 2015" }
];

// ---------------------------------------------------------------------------
// SAP Catalog — Fonte de Verdade
// Gerado a partir de: modelos-excel/Catálogo SAP.xlsx
// Col K = tipo_do_servico | Col L = tipo_do_equipamento
// ---------------------------------------------------------------------------
interface SapCatalogEntry {
    codigo_do_item: string;
    rental_codigo_sap: string | null;
    rental_descricao: string | null;
    rental_und: string | null;
    rental_preco: number | null;
    mobra_codigo_sap: string | null;
    mobra_descricao: string | null;
    mobra_und: string | null;
    mobra_preco: number | null;
    tipo_do_equipamento: string | null;
    tipo_do_servico: string | null;
}

const SAP_CATALOG: SapCatalogEntry[] = [
    { codigo_do_item: "100", rental_codigo_sap: "S.VP-01435", rental_descricao: "Mobilização De Retroescavadeira C/ Operador", rental_und: "VB", rental_preco: 1569.45, mobra_codigo_sap: "S.VP-01477", mobra_descricao: "MOBILIZAÇÃO DE RETROESCAVADEIRA C/ OPERADOR", mobra_und: "VB", mobra_preco: 963.41, tipo_do_equipamento: "Retroescavadeira", tipo_do_servico: "Mobilização" },
    { codigo_do_item: "110", rental_codigo_sap: "S.VP-01436", rental_descricao: "Desmobilização De Retroescavadeira C/ Operador", rental_und: "VB", rental_preco: 1569.45, mobra_codigo_sap: "S.VP-01478", mobra_descricao: "DESMOBILIZAÇÃO DE RETROESCAVADEIRA C/ OPERADOR", mobra_und: "VB", mobra_preco: 963.41, tipo_do_equipamento: "Retroescavadeira", tipo_do_servico: "Desmobilização" },
    { codigo_do_item: "120", rental_codigo_sap: "S.VP-01437", rental_descricao: "Hr Produtiva Retroescavadeira C/Operador", rental_und: "H", rental_preco: 160.71, mobra_codigo_sap: "S.VP-01395", mobra_descricao: "HR PRODUTIVA RETROESCAVADEIRA C/OPERADOR", mobra_und: "H", mobra_preco: 65.42, tipo_do_equipamento: "Retroescavadeira", tipo_do_servico: "Produtivo" },
    { codigo_do_item: "130", rental_codigo_sap: "S.VP-01438", rental_descricao: "Hr Improdutiva Retroescavadeira C/Operador", rental_und: "H", rental_preco: 108.23, mobra_codigo_sap: "S.VP-01396", mobra_descricao: "HR IMPRODUTIVA RETROESCAVADEIRA C/OPERADOR", mobra_und: "H", mobra_preco: 65.42, tipo_do_equipamento: "Retroescavadeira", tipo_do_servico: "Improdutivo" },
    { codigo_do_item: "140", rental_codigo_sap: "S.VP-01439", rental_descricao: "Mobilização Pa Carregadeira C/ Operador", rental_und: "VB", rental_preco: 2319.45, mobra_codigo_sap: "S.VP-01397", mobra_descricao: "MOBILIZAÇÃO PA CARREGADEIRA C/ OPERADOR", mobra_und: "VB", mobra_preco: 1045.98, tipo_do_equipamento: "Pá Carregadeira", tipo_do_servico: "Mobilização" },
    { codigo_do_item: "150", rental_codigo_sap: "S.VP-01440", rental_descricao: "Desmobilização De Pa Carregadeira C/Operador", rental_und: "VB", rental_preco: 2319.45, mobra_codigo_sap: "S.VP-01398", mobra_descricao: "DESMOBILIZAÇÃO DE PA CARREGADEIRA C/OPERADOR", mobra_und: "VB", mobra_preco: 1045.98, tipo_do_equipamento: "Pá Carregadeira", tipo_do_servico: "Desmobilização" },
    { codigo_do_item: "160", rental_codigo_sap: "S.VP-01441", rental_descricao: "Hora Produtiva Pa Carregadeira C/Operador", rental_und: "H", rental_preco: 218.44, mobra_codigo_sap: "S.VP-01399", mobra_descricao: "HORA PRODUTIVA PA CARREGADEIRA C/OPERADOR", mobra_und: "H", mobra_preco: 65.42, tipo_do_equipamento: "Pá Carregadeira", tipo_do_servico: "Produtivo" },
    { codigo_do_item: "170", rental_codigo_sap: "S.VP-01442", rental_descricao: "Hora Improdutiva Pa Carregadeira C/Operador", rental_und: "H", rental_preco: 144.96, mobra_codigo_sap: "S.VP-01400", mobra_descricao: "HORA IMPRODUTIVA PA CARREGADEIRA C/OPERADOR", mobra_und: "H", mobra_preco: 65.42, tipo_do_equipamento: "Pá Carregadeira", tipo_do_servico: "Improdutivo" },
    { codigo_do_item: "180", rental_codigo_sap: "S.VP-01443", rental_descricao: "Mobilização Caminhão Basculante - C/Motorista", rental_und: "VB", rental_preco: 1137.96, mobra_codigo_sap: "S.VP-01401", mobra_descricao: "MOBILIZAÇÃO CAMINHÃO BASCULANTE - C/MOTORISTA", mobra_und: "VB", mobra_preco: 281.11, tipo_do_equipamento: "Caminhão Basculante", tipo_do_servico: "Mobilização" },
    { codigo_do_item: "190", rental_codigo_sap: "S.VP-01444", rental_descricao: "Desmobilização Caminhão Basculante - C/Motorista", rental_und: "VB", rental_preco: 1137.96, mobra_codigo_sap: "S.VP-01402", mobra_descricao: "DESMOBILIZAÇÃO CAMINHÃO BASCULANTE - C/MOTORISTA", mobra_und: "VB", mobra_preco: 281.11, tipo_do_equipamento: "Caminhão Basculante", tipo_do_servico: "Desmobilização" },
    { codigo_do_item: "200", rental_codigo_sap: "S.VP-01445", rental_descricao: "Km Rodado Caminhão Basculante - C/Motorista", rental_und: "KM", rental_preco: 7.35, mobra_codigo_sap: "S.VP-01403", mobra_descricao: "KM RODADO CAMINHÃO BASCULANTE - C/MOTORISTA", mobra_und: "KM", mobra_preco: 1.81, tipo_do_equipamento: "Caminhão Basculante", tipo_do_servico: "KM" },
    { codigo_do_item: "210", rental_codigo_sap: "S.VP-01446", rental_descricao: "Hora Improdutiva Basculante - C/Motorista", rental_und: "H", rental_preco: 132.89, mobra_codigo_sap: "S.VP-01404", mobra_descricao: "HORA IMPRODUTIVA BASCULANTE - C/MOTORISTA", mobra_und: "H", mobra_preco: 65.42, tipo_do_equipamento: "Caminhão Basculante", tipo_do_servico: "Improdutivo" },
    { codigo_do_item: "220", rental_codigo_sap: "S.VP-01447", rental_descricao: "Mobilização De Caminhão Pipa C/Mototista", rental_und: "VB", rental_preco: 1099.42, mobra_codigo_sap: "S.VP-01405", mobra_descricao: "MOBILIZAÇÃO DE CAMINHÃO PIPA C/MOTOTISTA", mobra_und: "VB", mobra_preco: 319.71, tipo_do_equipamento: "Caminhão Pipa", tipo_do_servico: "Mobilização" },
    { codigo_do_item: "230", rental_codigo_sap: "S.VP-01448", rental_descricao: "Desmobilização De Caminhão Pipa C/Mototista", rental_und: "VB", rental_preco: 1099.42, mobra_codigo_sap: "S.VP-01406", mobra_descricao: "DESMOBILIZAÇÃO DE CAMINHÃO PIPA C/MOTOTISTA", mobra_und: "VB", mobra_preco: 319.71, tipo_do_equipamento: "Caminhão Pipa", tipo_do_servico: "Desmobilização" },
    { codigo_do_item: "240", rental_codigo_sap: "S.VP-01449", rental_descricao: "Hora Produtiva Caminhão Pipa", rental_und: "H", rental_preco: 185.82, mobra_codigo_sap: "S.VP-01407", mobra_descricao: "HORA PRODUTIVA CAMINHÃO PIPA", mobra_und: "H", mobra_preco: 65.42, tipo_do_equipamento: "Caminhão Pipa", tipo_do_servico: "Produtivo" },
    { codigo_do_item: "250", rental_codigo_sap: "S.VP-01450", rental_descricao: "Hora Improdutiva Caminhão Pipa C/ Motorista", rental_und: "H", rental_preco: 95.84, mobra_codigo_sap: "S.VP-01408", mobra_descricao: "HORA IMPRODUTIVA CAMINHÃO PIPA C/ MOTORISTA", mobra_und: "H", mobra_preco: 65.42, tipo_do_equipamento: "Caminhão Pipa", tipo_do_servico: "Improdutivo" },
    { codigo_do_item: "260", rental_codigo_sap: "S.VP-01451", rental_descricao: "Mobilização De Motoniveladora C/Operador", rental_und: "VB", rental_preco: 2609.38, mobra_codigo_sap: "S.VP-01409", mobra_descricao: "MOBILIZAÇÃO DE MOTONIVELADORA C/OPERADOR", mobra_und: "VB", mobra_preco: 1188.01, tipo_do_equipamento: "Motoniveladora", tipo_do_servico: "Mobilização" },
    { codigo_do_item: "270", rental_codigo_sap: "S.VP-01452", rental_descricao: "Desmobilização De Motoniveladora C/Operador", rental_und: "VB", rental_preco: 2609.38, mobra_codigo_sap: "S.VP-01410", mobra_descricao: "DESMOBILIZAÇÃO DE MOTONIVELADORA C/OPERADOR", mobra_und: "VB", mobra_preco: 1188.01, tipo_do_equipamento: "Motoniveladora", tipo_do_servico: "Desmobilização" },
    { codigo_do_item: "280", rental_codigo_sap: "S.VP-01453", rental_descricao: "Hora Produtiva Motoniveladora C/Operador", rental_und: "H", rental_preco: 279.00, mobra_codigo_sap: "S.VP-01411", mobra_descricao: "HORA PRODUTIVA MOTONIVELADORA C/OPERADOR", mobra_und: "H", mobra_preco: 87.27, tipo_do_equipamento: "Motoniveladora", tipo_do_servico: "Produtivo" },
    { codigo_do_item: "290", rental_codigo_sap: "S.VP-01454", rental_descricao: "Hora Improdutiva Motoniveladora C/Operador", rental_und: "H", rental_preco: 193.29, mobra_codigo_sap: "S.VP-01412", mobra_descricao: "HORA IMPRODUTIVA MOTONIVELADORA C/OPERADOR", mobra_und: "H", mobra_preco: 87.27, tipo_do_equipamento: "Motoniveladora", tipo_do_servico: "Improdutivo" },
    { codigo_do_item: "3.25", rental_codigo_sap: "S.VP-01455", rental_descricao: "Mobilização De Trator Esteira – C/Operador", rental_und: "VB", rental_preco: 2525.62, mobra_codigo_sap: "S.VP-01413", mobra_descricao: "MOBILIZAÇÃO DE TRATOR ESTEIRA – C/OPERADOR", mobra_und: "VB", mobra_preco: 925.23, tipo_do_equipamento: "Trator de Esteira", tipo_do_servico: "Mobilização" },
    { codigo_do_item: "3.26", rental_codigo_sap: "S.VP-01456", rental_descricao: "Desmobilização De Trator Esteira – C/Operador", rental_und: "VB", rental_preco: 2525.62, mobra_codigo_sap: "S.VP-01414", mobra_descricao: "DESMOBILIZAÇÃO DE TRATOR ESTEIRA – C/OPERADOR", mobra_und: "VB", mobra_preco: 925.23, tipo_do_equipamento: "Trator de Esteira", tipo_do_servico: "Desmobilização" },
    { codigo_do_item: "3.27", rental_codigo_sap: "S.VP-01457", rental_descricao: "Hora Produtiva Trator Esteira – C/ Operador", rental_und: "H", rental_preco: 326.34, mobra_codigo_sap: "S.VP-01415", mobra_descricao: "HORA PRODUTIVA TRATOR ESTEIRA – C/ OPERADOR", mobra_und: "H", mobra_preco: 65.42, tipo_do_equipamento: "Trator de Esteira", tipo_do_servico: "Produtivo" },
    { codigo_do_item: "3.28", rental_codigo_sap: "S.VP-01458", rental_descricao: "Hora Improdutiva Trator Esteira – C/ Operador", rental_und: "H", rental_preco: 180.41, mobra_codigo_sap: "S.VP-01416", mobra_descricao: "HORA IMPRODUTIVA TRATOR ESTEIRA – C/ OPERADOR", mobra_und: "H", mobra_preco: 65.42, tipo_do_equipamento: "Trator de Esteira", tipo_do_servico: "Improdutivo" },
    { codigo_do_item: "380", rental_codigo_sap: "S.VP-01459", rental_descricao: "Mobilização Carreta Prancha - C/ Motorista", rental_und: "VB", rental_preco: 2236.74, mobra_codigo_sap: "S.VP-01417", mobra_descricao: "MOBILIZAÇÃO CARRETA PRANCHA - C/ MOTORISTA", mobra_und: "VB", mobra_preco: 785.33, tipo_do_equipamento: "Carreta Prancha", tipo_do_servico: "Mobilização" },
    { codigo_do_item: "390", rental_codigo_sap: "S.VP-01460", rental_descricao: "Desmobilização Carreta Prancha - C/ Motorista", rental_und: "VB", rental_preco: 2236.74, mobra_codigo_sap: "S.VP-01418", mobra_descricao: "DESMOBILIZAÇÃO CARRETA PRANCHA - C/ MOTORISTA", mobra_und: "VB", mobra_preco: 785.33, tipo_do_equipamento: "Carreta Prancha", tipo_do_servico: "Desmobilização" },
    { codigo_do_item: "400", rental_codigo_sap: "S.VP-01461", rental_descricao: "Km Rodado Carreta Prancha - C/ Motorista", rental_und: "KM", rental_preco: 7.10, mobra_codigo_sap: "S.VP-01419", mobra_descricao: "KM RODADO CARRETA PRANCHA - C/ MOTORISTA", mobra_und: "KM", mobra_preco: 2.50, tipo_do_equipamento: "Carreta Prancha", tipo_do_servico: "KM" },
    { codigo_do_item: "410", rental_codigo_sap: "S.VP-01462", rental_descricao: "Hora Improdutiva Carreta Prancha - C/ Motorista", rental_und: "H", rental_preco: 112.76, mobra_codigo_sap: "S.VP-01420", mobra_descricao: "HORA IMPRODUTIVA CARRETA PRANCHA - C/ MOTORISTA", mobra_und: "H", mobra_preco: 87.27, tipo_do_equipamento: "Carreta Prancha", tipo_do_servico: "Improdutivo" },
    { codigo_do_item: "460", rental_codigo_sap: "S.VP-01463", rental_descricao: "Mobilização Miniescavadeira C/ Operador", rental_und: "VB", rental_preco: 1455.25, mobra_codigo_sap: "S.VP-01421", mobra_descricao: "MOBILIZAÇÃO MINIESCAVADEIRA C/ OPERADOR", mobra_und: "VB", mobra_preco: 908.71, tipo_do_equipamento: "Miniescavadeira", tipo_do_servico: "Mobilização" },
    { codigo_do_item: "470", rental_codigo_sap: "S.VP-01464", rental_descricao: "Desmobilização Miniescavadeira C/ Operador", rental_und: "VB", rental_preco: 1455.25, mobra_codigo_sap: "S.VP-01422", mobra_descricao: "DESMOBILIZAÇÃO MINIESCAVADEIRA C/ OPERADOR", mobra_und: "VB", mobra_preco: 908.70, tipo_do_equipamento: "Miniescavadeira", tipo_do_servico: "Desmobilização" },
    { codigo_do_item: "480", rental_codigo_sap: "S.VP-01465", rental_descricao: "Hora Produtiva Miniescavadeira Hidraulica C/ Operador", rental_und: "H", rental_preco: 138.38, mobra_codigo_sap: "S.VP-01423", mobra_descricao: "HORA PRODUTIVA MINIESCAVADEIRA HIDRAULICA C/ OPERADOR", mobra_und: "H", mobra_preco: 65.42, tipo_do_equipamento: "Miniescavadeira", tipo_do_servico: "Produtivo" },
    { codigo_do_item: "490", rental_codigo_sap: "S.VP-01466", rental_descricao: "Hora Improdutiva Miniescavadeira Hidraulica C/ Operador", rental_und: "H", rental_preco: 104.71, mobra_codigo_sap: "S.VP-01424", mobra_descricao: "HORA IMPRODUTIVA MINIESCAVADEIRA HIDRAULICA C/ OPERADOR", mobra_und: "H", mobra_preco: 65.42, tipo_do_equipamento: "Miniescavadeira", tipo_do_servico: "Improdutivo" },
    { codigo_do_item: "500", rental_codigo_sap: "S.VP-01467", rental_descricao: "Mobilização Escavadeira Hidraulica", rental_und: "VB", rental_preco: 4625.90, mobra_codigo_sap: "S.VP-01425", mobra_descricao: "MOBILIZAÇÃO ESCAVADEIRA HIDRAULICA", mobra_und: "VB", mobra_preco: 1632.59, tipo_do_equipamento: "Escavadeira Hidráulica", tipo_do_servico: "Mobilização" },
    { codigo_do_item: "510", rental_codigo_sap: "S.VP-01468", rental_descricao: "Desmobilização Escavadeira Hidraulica", rental_und: "VB", rental_preco: 4625.90, mobra_codigo_sap: "S.VP-01426", mobra_descricao: "DESMOBILIZAÇÃO ESCAVADEIRA HIDRAULICA", mobra_und: "VB", mobra_preco: 1632.60, tipo_do_equipamento: "Escavadeira Hidráulica", tipo_do_servico: "Desmobilização" },
    { codigo_do_item: "520", rental_codigo_sap: "S.VP-01469", rental_descricao: "Hora Produtiva Escavadeira Hidraulica", rental_und: "H", rental_preco: 283.19, mobra_codigo_sap: "S.VP-01427", mobra_descricao: "HORA PRODUTIVA ESCAVADEIRA HIDRAULICA", mobra_und: "H", mobra_preco: 65.42, tipo_do_equipamento: "Escavadeira Hidráulica", tipo_do_servico: "Produtivo" },
    { codigo_do_item: "530", rental_codigo_sap: "S.VP-01470", rental_descricao: "Hora Improdutiva Escavadeira Hidraulica", rental_und: "H", rental_preco: 185.23, mobra_codigo_sap: "S.VP-01428", mobra_descricao: "HORA IMPRODUTIVA ESCAVADEIRA HIDRAULICA", mobra_und: "H", mobra_preco: 65.42, tipo_do_equipamento: "Escavadeira Hidráulica", tipo_do_servico: "Improdutivo" },
    { codigo_do_item: "3.41", rental_codigo_sap: "S.VP-01471", rental_descricao: "Mobilização Rolo Compactador C/ Operador", rental_und: "VB", rental_preco: 1872.58, mobra_codigo_sap: "S.VP-01429", mobra_descricao: "MOBILIZAÇÃO ROLO COMPACTADOR C/ OPERADOR", mobra_und: "VB", mobra_preco: 1013.30, tipo_do_equipamento: "Rolo Compactador", tipo_do_servico: "Mobilização" },
    { codigo_do_item: "3.42", rental_codigo_sap: "S.VP-01472", rental_descricao: "Desmobilização Rolo Compactador C/ Operador", rental_und: "VB", rental_preco: 1590.13, mobra_codigo_sap: "S.VP-01430", mobra_descricao: "DESMOBILIZAÇÃO ROLO COMPACTADOR C/ OPERADOR", mobra_und: "VB", mobra_preco: 697.80, tipo_do_equipamento: "Rolo Compactador", tipo_do_servico: "Desmobilização" },
    { codigo_do_item: "3.43", rental_codigo_sap: "S.VP-01473", rental_descricao: "Hora Produtiva Rolo Compactador C/Operador", rental_und: "H", rental_preco: 163.66, mobra_codigo_sap: "S.VP-01431", mobra_descricao: "HORA PRODUTIVA ROLO COMPACTADOR C/OPERADOR", mobra_und: "H", mobra_preco: 65.42, tipo_do_equipamento: "Rolo Compactador", tipo_do_servico: "Produtivo" },
    { codigo_do_item: "3.44", rental_codigo_sap: "S.VP-01474", rental_descricao: "Hora Improdutiva Rolo Compactador C/Operador", rental_und: "H", rental_preco: 120.81, mobra_codigo_sap: "S.VP-01432", mobra_descricao: "HORA IMPRODUTIVA ROLO COMPACTADOR C/OPERADOR", mobra_und: "H", mobra_preco: 65.42, tipo_do_equipamento: "Rolo Compactador", tipo_do_servico: "Improdutivo" },
    { codigo_do_item: "580", rental_codigo_sap: "S.VP-01475", rental_descricao: "Transporte Rodoviario Carro 5 Passageiros", rental_und: "MES", rental_preco: 16354.10, mobra_codigo_sap: null, mobra_descricao: null, mobra_und: null, mobra_preco: null, tipo_do_equipamento: "Veículo Leve", tipo_do_servico: "Produtivo" },
    { codigo_do_item: "590", rental_codigo_sap: "S.VP-01476", rental_descricao: "Transporte Rodoviario Carro 7 Passageiros", rental_und: "MES", rental_preco: 17419.43, mobra_codigo_sap: null, mobra_descricao: null, mobra_und: null, mobra_preco: null, tipo_do_equipamento: "Veículo Leve", tipo_do_servico: "Produtivo" },
];

/**
 * DEFAULT_SERVICE_PRICES — gerado automaticamente do SAP_CATALOG.
 * Cada entrada do catálogo gera uma entrada RENTAL e uma MOBRA.
 * Os campos tipo_do_equipamento e tipo_do_servico permitem lookup exato
 * pelo parser de importação Excel.
 */
export const DEFAULT_SERVICE_PRICES: ServicePrice[] = SAP_CATALOG.flatMap(entry => {
    const prices: ServicePrice[] = [];

    if (entry.rental_codigo_sap && entry.rental_descricao) {
        prices.push({
            item: entry.codigo_do_item,
            codigo_sap: entry.rental_codigo_sap,
            descricao: entry.rental_descricao,
            unidade: entry.rental_und ?? 'VB',
            preco_unitario: entry.rental_preco,
            quantidade: 1,
            valor_total: entry.rental_preco,
            category: 'RENTAL',
            tipo_do_equipamento: entry.tipo_do_equipamento ?? undefined,
            tipo_do_servico: entry.tipo_do_servico ?? undefined,
        });
    }

    if (entry.mobra_codigo_sap && entry.mobra_descricao) {
        prices.push({
            item: entry.codigo_do_item,
            codigo_sap: entry.mobra_codigo_sap,
            descricao: entry.mobra_descricao,
            unidade: entry.mobra_und ?? 'VB',
            preco_unitario: entry.mobra_preco,
            quantidade: 1,
            valor_total: entry.mobra_preco,
            category: 'MOBRA',
            tipo_do_equipamento: entry.tipo_do_equipamento ?? undefined,
            tipo_do_servico: entry.tipo_do_servico ?? undefined,
        });
    }

    return prices;
});

