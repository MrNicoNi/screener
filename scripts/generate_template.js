import * as XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const data = [
    { Nome: 'João Silva', Email: 'joao.silva@exemplo.com', Perfil: 'Analista', Time: 'Operações' },
    { Nome: 'Maria Santos', Email: 'maria.santos@exemplo.com', Perfil: 'Avaliador', Time: 'Qualidade' },
    { Nome: 'Pedro Costa', Email: 'pedro.costa@exemplo.com', Perfil: 'Admin', Time: 'Gestão' },
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Modelo");

// Adjust column widths
const wscols = [
    { wch: 30 }, // Nome
    { wch: 35 }, // Email
    { wch: 15 }, // Perfil
    { wch: 20 }, // Time
];
ws['!cols'] = wscols;

const outputPath = path.resolve(__dirname, '../public/modelo_usuarios.xlsx');
XLSX.writeFile(wb, outputPath);

console.log(`Template created at: ${outputPath}`);
