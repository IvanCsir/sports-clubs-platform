/**
 * Web Citaciones y Evaluaciones Físicas - Club Regatas Andino
 * Manejo de Citaciones (Primera e Intermedia) y Rendimiento Físico
 * Sincronización en Vivo con Google Sheets (Citaciones y Físico)
 */

// ============================================================================
// CONFIGURACIÓN Y ESTADO GLOBAL
// ============================================================================

let matchData = null;
let currentCategory = 'primera'; // 'primera' | 'intermedia'

// Torneo AMH (Clausura Damas B 2026)
let TOURNAMENT_STORAGE_KEY = 'regatas_andino_torneo_v4';
let tournamentData = null;
let currentTournamentDivision = 'primera'; // 'primera' | 'intermedia'
let currentMatchesTab = 'played'; // 'played' | 'pending'

// Evaluaciones Físicas
let PHYSICAL_SPREADSHEET_ID = "1dAoeA0_F4RGLDEJj0taIJiPA3WlMWl5e";
let PHYSICAL_STORAGE_KEY = "regatas_andino_fisico_v1";
let physicalPlayers = [];
let physicalCategoryAverages = null;
let selectedPlayerId = null;
let currentPhysFilter = "all"; // 'all' | '1ra' | 'Inter' | '5ta'
let currentPhysBenchmarkScope = "category"; // 'category' | 'all'
let currentPhysViewMode = "players"; // 'players' | 'averages' | 'top10'
let currentTop10Test = "all"; // 'all' | 'broadJump' | 'cmj' | 'agility' | 'sprint' | 'yoyo' | 'bench' | 'deadlift' | 'squat' | 'platform'
let currentTop10Round = "latest"; // 'latest' | 'best' | 'avg' | '1' | '2' | '3'

let STORAGE_KEY = 'regatas_andino_citaciones_v6';

// Sesión y Seguridad de Cuerpo Técnico (Expiración de 12hs validada por /api/auth)
let CT_AUTH_STORAGE_KEY = 'regatas_ct_session_v4';
let DT_SPREADSHEET_ID = '1EfZtExHcLrio49A3wmyZcUOCZYZ7jNnatFt-wsebPQg';
let DT_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1EfZtExHcLrio49A3wmyZcUOCZYZ7jNnatFt-wsebPQg/edit';
