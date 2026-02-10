# 🚀 Guia: Auto-Update com GitHub Releases

## ✅ Configuração Completa (Passo a Passo)

Este guia mostra como usar **GitHub Releases** para distribuir atualizações automáticas da sua aplicação Electron.

---

## 📋 Pré-requisitos

- ✅ Repositório GitHub: `https://github.com/Dani777777777/liturgia-iasd-desktop`
- ✅ Código já configurado (URL do GitHub Releases no `main.ts`)
- ✅ GitHub CLI instalado (opcional, mas recomendado)

---

## 🎯 Fluxo Completo

### 1️⃣ **Primeira Versão (v1.0.0)**

#### Passo 1: Compilar a aplicação
```bash
npm run dist
```

#### Passo 2: Localizar os arquivos gerados
```
out/make/squirrel.windows/x64/
├── LiturgiaIASD-1.0.0 Setup.exe      ← Instalador (para distribuir)
├── RELEASES                           ← Arquivo de metadados
└── liturgia-iasd-1.0.0-full.nupkg    ← Pacote completo
```

#### Passo 3: Criar Release no GitHub

**Opção A: Via Interface Web (Mais Fácil)**

1. Acesse: https://github.com/Dani777777777/liturgia-iasd-desktop/releases/new

2. Preencha:
   - **Tag version**: `v1.0.0`
   - **Release title**: `Versão 1.0.0`
   - **Description**: 
     ```
     ## 🎉 Primeira Versão
     
     ### Funcionalidades
     - ✅ Painel de controlo nativo
     - ✅ Suporte multi-monitor
     - ✅ Projeção em ecrã total
     - ✅ Auto-update integrado
     ```

3. **Anexar arquivos** (arrastar e soltar):
   - ✅ `LiturgiaIASD-1.0.0 Setup.exe`
   - ✅ `RELEASES`
   - ✅ `liturgia-iasd-1.0.0-full.nupkg`

4. Clicar em **"Publish release"**

**Opção B: Via GitHub CLI (Mais Rápido)**

```bash
# Navegar para a pasta do projeto
cd "c:\Users\danie\Documents\Sites em desenvolvimento\liturgia-iasd-projetos\liturgia-iasd-desktop"

# Criar release com arquivos
gh release create v1.0.0 \
  --title "Versão 1.0.0" \
  --notes "🎉 Primeira versão com auto-update integrado" \
  "out/make/squirrel.windows/x64/LiturgiaIASD-1.0.0 Setup.exe" \
  "out/make/squirrel.windows/x64/RELEASES" \
  "out/make/squirrel.windows/x64/liturgia-iasd-1.0.0-full.nupkg"
```

#### Passo 4: Distribuir o instalador

Compartilhe o link do instalador:
```
https://github.com/Dani777777777/liturgia-iasd-desktop/releases/download/v1.0.0/LiturgiaIASD-1.0.0%20Setup.exe
```

Ou use o link "latest" (sempre aponta para a versão mais recente):
```
https://github.com/Dani777777777/liturgia-iasd-desktop/releases/latest/download/LiturgiaIASD-1.0.0%20Setup.exe
```

---

### 2️⃣ **Nova Versão (v1.1.0)**

#### Passo 1: Atualizar versão no código

Editar `package.json`:
```json
{
  "version": "1.1.0"
}
```

#### Passo 2: Fazer commit e push
```bash
git add package.json
git commit -m "Bump version to 1.1.0"
git push
```

#### Passo 3: Compilar nova versão
```bash
npm run dist
```

#### Passo 4: Criar novo Release no GitHub

**Via Interface Web:**

1. Acesse: https://github.com/Dani777777777/liturgia-iasd-desktop/releases/new

2. Preencha:
   - **Tag version**: `v1.1.0`
   - **Release title**: `Versão 1.1.0`
   - **Description**: 
     ```
     ## 🆕 Novidades
     - ✅ Correção de bug ao fechar apresentação
     - ✅ Melhorias de performance
     
     ## 🔄 Atualização Automática
     Usuários da v1.0.0 receberão esta atualização automaticamente!
     ```

3. **Anexar arquivos**:
   - ✅ `LiturgiaIASD-1.1.0 Setup.exe`
   - ✅ `RELEASES`
   - ✅ `liturgia-iasd-1.1.0-full.nupkg`

4. Clicar em **"Publish release"**

**Via GitHub CLI:**

```bash
gh release create v1.1.0 \
  --title "Versão 1.1.0" \
  --notes "🆕 Correções e melhorias" \
  "out/make/squirrel.windows/x64/LiturgiaIASD-1.1.0 Setup.exe" \
  "out/make/squirrel.windows/x64/RELEASES" \
  "out/make/squirrel.windows/x64/liturgia-iasd-1.1.0-full.nupkg"
```

#### Passo 5: Aguardar atualizações automáticas! 🎉

**O que acontece:**
1. Usuários com v1.0.0 abrem o app
2. App verifica: `https://github.com/.../releases/latest/download/RELEASES`
3. Detecta v1.1.0 disponível
4. Baixa `liturgia-iasd-1.1.0-full.nupkg` em background
5. Notifica usuário: "Reiniciar para atualizar?"
6. Usuário reinicia → v1.1.0 instalada! ✅

---

## 🔍 Como Funciona Tecnicamente

### URL do GitHub Releases

```
https://github.com/Dani777777777/liturgia-iasd-desktop/releases/latest/download/RELEASES
│                    │                                  │      │        │
│                    │                                  │      │        └─ Nome do arquivo
│                    │                                  │      └─ Sempre pega a versão mais recente
│                    │                                  └─ Endpoint de download
│                    └─ Seu repositório
└─ GitHub
```

### Quando você cria um Release:

```
Release v1.1.0
├── LiturgiaIASD-1.1.0 Setup.exe      ← Para novos usuários
├── RELEASES                           ← Squirrel lê este arquivo
└── liturgia-iasd-1.1.0-full.nupkg    ← Squirrel baixa este arquivo
```

### O arquivo RELEASES contém:

```
A1B2C3D4E5F6 liturgia-iasd-1.1.0-full.nupkg 45678901
│            │                              │
│            │                              └─ Tamanho
│            └─ Nome do arquivo para download
└─ Hash SHA1 (verificação de integridade)
```

### Squirrel verifica:

1. **GET** `https://github.com/.../releases/latest/download/RELEASES`
2. Lê a versão do `.nupkg` (ex: `1.1.0`)
3. Compara com versão local (ex: `1.0.0`)
4. Se diferente → **GET** `https://github.com/.../releases/latest/download/liturgia-iasd-1.1.0-full.nupkg`
5. Instala e notifica usuário

---

## 📦 Estrutura de Releases no GitHub

```
Releases
│
├── v1.0.0 (Latest)
│   ├── LiturgiaIASD-1.0.0 Setup.exe
│   ├── RELEASES
│   └── liturgia-iasd-1.0.0-full.nupkg
│
├── v1.1.0 (Latest) ← Quando publicar
│   ├── LiturgiaIASD-1.1.0 Setup.exe
│   ├── RELEASES
│   └── liturgia-iasd-1.1.0-full.nupkg
│
└── v1.2.0 (Latest) ← Futuro
    ├── LiturgiaIASD-1.2.0 Setup.exe
    ├── RELEASES
    └── liturgia-iasd-1.2.0-full.nupkg
```

**Importante:** O GitHub sempre marca o release mais recente como "Latest", então a URL `/latest/download/` sempre aponta para a versão mais nova!

---

## 🎯 Comandos Úteis

### Instalar GitHub CLI (se não tiver)

**Windows (via winget):**
```bash
winget install --id GitHub.cli
```

**Windows (via Chocolatey):**
```bash
choco install gh
```

**Verificar instalação:**
```bash
gh --version
```

**Login:**
```bash
gh auth login
```

### Criar Release Rapidamente

```bash
# Template completo
gh release create v1.X.X \
  --title "Versão 1.X.X" \
  --notes "Descrição das mudanças" \
  "out/make/squirrel.windows/x64/LiturgiaIASD-1.X.X Setup.exe" \
  "out/make/squirrel.windows/x64/RELEASES" \
  "out/make/squirrel.windows/x64/liturgia-iasd-1.X.X-full.nupkg"
```

### Listar Releases

```bash
gh release list
```

### Ver detalhes de um Release

```bash
gh release view v1.0.0
```

### Deletar Release (se errar)

```bash
gh release delete v1.0.0 --yes
```

---

## ✅ Checklist de Publicação

Antes de criar um novo release:

- [ ] Atualizar `version` no `package.json`
- [ ] Fazer commit: `git commit -m "Bump version to X.X.X"`
- [ ] Push: `git push`
- [ ] Compilar: `npm run dist`
- [ ] Testar instalador localmente
- [ ] Criar release no GitHub
- [ ] Upload dos 3 arquivos:
  - [ ] `Setup.exe`
  - [ ] `RELEASES`
  - [ ] `.nupkg`
- [ ] Publicar release
- [ ] Testar auto-update em app antigo

---

## 🐛 Troubleshooting

### Erro: "404 Not Found"

**Causa:** Release não existe ou arquivos não foram anexados

**Solução:**
1. Verificar se o release existe: https://github.com/Dani777777777/liturgia-iasd-desktop/releases
2. Verificar se os 3 arquivos estão anexados
3. Verificar se o release está marcado como "Latest"

### Erro: "Update not available" (mas há nova versão)

**Causa:** Versão no `package.json` não foi incrementada

**Solução:**
```bash
# Verificar versão atual
cat package.json | grep version

# Atualizar e recompilar
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.0 → 1.1.0
npm version major  # 1.0.0 → 2.0.0

npm run dist
```

### Erro: "RELEASES file malformed"

**Causa:** Arquivo RELEASES corrompido ou editado manualmente

**Solução:**
- Sempre usar o arquivo `RELEASES` gerado pelo `npm run dist`
- Nunca editar manualmente

---

## 🎓 Exemplo Completo (v1.0.0 → v1.1.0)

```bash
# 1. Atualizar versão
npm version minor  # 1.0.0 → 1.1.0

# 2. Commit
git add package.json package-lock.json
git commit -m "Bump version to 1.1.0"
git push

# 3. Compilar
npm run dist

# 4. Criar release
gh release create v1.1.0 \
  --title "Versão 1.1.0 - Correções e Melhorias" \
  --notes "🐛 Corrigido bug ao fechar apresentação
✨ Melhorias de performance
🔄 Atualização automática disponível" \
  "out/make/squirrel.windows/x64/LiturgiaIASD-1.1.0 Setup.exe" \
  "out/make/squirrel.windows/x64/RELEASES" \
  "out/make/squirrel.windows/x64/liturgia-iasd-1.1.0-full.nupkg"

# 5. Pronto! Usuários receberão update automaticamente
```

---

## 🌟 Vantagens do GitHub Releases

- ✅ **Grátis** - Sem custos
- ✅ **CDN Global** - Download rápido em qualquer lugar
- ✅ **Versionamento** - Histórico completo
- ✅ **Changelog** - Release notes integradas
- ✅ **Confiável** - Infraestrutura do GitHub
- ✅ **Fácil** - Interface simples
- ✅ **API** - Automação via CLI

---

## 📚 Links Úteis

- **Seu repositório:** https://github.com/Dani777777777/liturgia-iasd-desktop
- **Releases:** https://github.com/Dani777777777/liturgia-iasd-desktop/releases
- **Criar novo release:** https://github.com/Dani777777777/liturgia-iasd-desktop/releases/new
- **GitHub CLI:** https://cli.github.com/

---

## 🎉 Pronto para Usar!

Agora é só:
1. Compilar: `npm run dist`
2. Criar release no GitHub
3. Distribuir o `Setup.exe`
4. Atualizações futuras serão automáticas! 🚀
