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
- `npm run dev`: Inicia o servidor de desenvolvimento.
- `npm start`: Compila o código TypeScript e inicia a aplicação.
- `npm run build`: Apenas compila o código TypeScript.
- `npm run pack`: Gera os pacotes executáveis.
- `npm run dist`: Gera o instalador final do Windows.

## 📦 Estrutura do Projeto

- `src/main.ts`: Lógica principal do Electron (gestão de janelas e ecrãs).
- `src/preload.ts`: Script de ponte seguro para exposição de APIs ao frontend.
- `build/`: Ativos de build (ícones e imagens).
- `forge.config.js`: Configuração do Electron Forge para packaging.

## 🌐 Integração
A aplicação aponta por defeito para:
- Desenvolvimento: `http://localhost:3000`
- Produção: `https://liturgia-iasd.vercel.app`

## 📄 Licença
Este projeto está sob a licença ISC.
