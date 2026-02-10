# Liturgia IASD Desktop

Wrapper Electron para a aplicação de gestão de liturgia da IASD, permitindo uma experiência nativa com suporte avançado para projeção multi-janela.

## 🚀 Funcionalidades

- **Painel de Controlo Nativo**: Interface otimizada para gestão da liturgia em tempo real.
- **Suporte Multi-Monitor**: Projeção direta em ecrãs secundários (projetores/TVs) sem molduras e em ecrã total.
- **Deteção Automática**: Identifica automaticamente novos monitores conectados.
- **Persistência**: Lembra-se da configuração de ecrã preferida para projeção.
- **Menu Integrado**: Atalhos para ferramentas de desenvolvimento e gestão de janelas.

## 🛠️ Instalação e Desenvolvimento

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior recomendada)
- Git

### Configuração Inicial
```bash
# Instalar dependências
npm install
```

### Comandos Disponíveis

#### Desenvolvimento
- **`npm run dev`**: Inicia o servidor Next.js e abre a aplicação Electron
  - Ideal para testar mudanças em tempo real
  - Usa `http://localhost:3000`

- **`npm start`**: Compila TypeScript e inicia a aplicação
  - Usa a URL de produção (Vercel)
  - Sem hot-reload

- **`npm run build`**: Apenas compila o código TypeScript
  - Não cria executável

#### Distribuição

- **`npm run pack`**: Empacota a aplicação sem criar instalador
  - Gera apenas os arquivos da aplicação

- **`npm run dist`**: 🎯 **Cria o instalador final para distribuição**
  - **Windows** (executar no Windows):
    - ✅ `LiturgiaIASD-[version] Setup.exe` - Instalador Squirrel
    - ✅ `.zip` - Versão portátil
    - 📁 Localização: `out/make/squirrel.windows/x64/` e `out/make/zip/win32/x64/`
  
  - **Mac** (executar no Mac):
    - ✅ `Liturgia IASD-[version].dmg` - Instalador DMG
    - ✅ `.zip` - Versão portátil
    - 📁 Localização: `out/make/dmg/x64/` e `out/make/zip/darwin/x64/`

### 📦 Compilação para Diferentes Plataformas

#### Para Windows (no Windows)
```bash
npm run dist
```
**Requisitos:**
- Node.js instalado
- Ícone: `build/icon.ico` ✅ (já existe)

#### Para Mac (no Mac)
```bash
npm run dist
```
**Requisitos:**
- Node.js instalado
- Xcode Command Line Tools: `xcode-select --install`
- Ícone: `build/icon.icns` ⚠️ (precisa ser criado)

**Como criar icon.icns:**
```bash
# No Mac, a partir do icon.png
mkdir icon.iconset
sips -z 16 16     build/icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     build/icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     build/icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     build/icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   build/icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   build/icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   build/icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   build/icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   build/icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 build/icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o build/icon.icns
rm -rf icon.iconset
```

**⚠️ Nota sobre Cross-Compilation:**
- Não é possível compilar para Mac no Windows (e vice-versa) sem configuração adicional complexa
- Para distribuir em ambas plataformas:
  - Execute `npm run dist` no Windows → gera `.exe`
  - Execute `npm run dist` no Mac → gera `.dmg`

## 📦 Estrutura do Projeto

- `src/main.ts`: Lógica principal do Electron (gestão de janelas e ecrãs).
- `src/preload.ts`: Script de ponte seguro para exposição de APIs ao frontend.
- `build/`: Ativos de build (ícones e imagens).
- `forge.config.js`: Configuração do Electron Forge para packaging.

## 🌐 Integração
A aplicação aponta por defeito para:
- Desenvolvimento: `http://localhost:3000`
- Produção: `https://liturgia-iasd.vercel.app`

## 🔄 Auto-Update (Atualizações Automáticas)

A aplicação inclui um sistema de **auto-update** integrado usando Squirrel.Windows:

### ✨ Funcionalidades
- ✅ Verificação automática de atualizações (startup + a cada 4 horas)
- ✅ Download e instalação em background
- ✅ Notificação ao usuário quando pronto
- ✅ Verificação manual via menu: **Ajuda > Verificar Atualizações**
- ✅ Delta updates (baixa apenas diferenças entre versões)

### 📦 Como Funciona
```
App inicia → Verifica servidor → Nova versão? → Baixa em background → 
Notifica usuário → Reinicia → Atualizado! ✅
```

### ⚙️ Configuração
Para habilitar auto-updates em produção:

1. **Hospedar arquivos de update** (após `npm run dist`):
   - `RELEASES` (metadados)
   - `liturgia-iasd-[version]-full.nupkg` (pacote)

2. **Configurar URL no código** (`src/main.ts`):
   ```typescript
   const UPDATE_SERVER_URL = 'https://seu-servidor.com/updates';
   ```

3. **Opções de hospedagem:**
   - GitHub Releases (recomendado - grátis)
   - Vercel/Netlify
   - Servidor próprio

📖 **Guia completo:** Veja [AUTO_UPDATE_GUIDE.md](./AUTO_UPDATE_GUIDE.md) para instruções detalhadas.

## 📄 Licença
Este projeto está sob a licença ISC.
