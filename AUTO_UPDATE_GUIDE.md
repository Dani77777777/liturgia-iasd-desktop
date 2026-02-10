# 🔄 Sistema de Auto-Update - Guia Completo

## 📋 Visão Geral

O sistema de auto-update do Squirrel permite que sua aplicação se atualize automaticamente sem intervenção do usuário. Este guia explica como funciona e como configurar.

## 🎯 Como Funciona

### Fluxo Completo

```
1. App Inicia
   ↓
2. Aguarda 3 segundos
   ↓
3. Verifica servidor: GET https://seu-servidor.com/updates/RELEASES
   ↓
4. Compara versão local vs servidor
   ↓
   ├─→ Versão igual: "App is up to date" ✅
   │
   └─→ Nova versão disponível:
       ↓
       5. Baixa .nupkg em background
       ↓
       6. Instala automaticamente
       ↓
       7. Notifica usuário: "Reiniciar agora ou depois?"
       ↓
       8. Usuário reinicia → Nova versão! 🎉
```

### Verificações Automáticas

- ✅ **No startup**: 3 segundos após abrir
- ✅ **Periódicas**: A cada 4 horas
- ✅ **Manual**: Menu "Ajuda > Verificar Atualizações"

## 🛠️ Configuração do Servidor

### 1. Estrutura de Arquivos

Você precisa hospedar 2 arquivos em um servidor web acessível:

```
https://seu-servidor.com/updates/
├── RELEASES                          ← Arquivo de metadados
└── liturgia-iasd-1.1.0-full.nupkg   ← Pacote da nova versão
```

### 2. Arquivo RELEASES

Formato:
```
[SHA1-HASH] [NOME-DO-ARQUIVO] [TAMANHO-EM-BYTES]
```

Exemplo real:
```
A1B2C3D4E5F6789012345678901234567890ABCD liturgia-iasd-1.1.0-full.nupkg 45678901
```

**Como gerar:**
Após `npm run dist`, o arquivo `RELEASES` é gerado automaticamente em:
```
out/make/squirrel.windows/x64/RELEASES
```

### 3. Opções de Hospedagem

#### Opção A: GitHub Releases (Recomendado - Grátis)
```javascript
// No main.ts, altere:
const UPDATE_SERVER_URL = 'https://github.com/seu-usuario/seu-repo/releases/latest/download';
```

**Passos:**
1. Crie um release no GitHub
2. Faça upload dos arquivos:
   - `RELEASES`
   - `liturgia-iasd-1.1.0-full.nupkg`
3. Pronto! O Squirrel baixará automaticamente

#### Opção B: Vercel/Netlify (Grátis)
```javascript
const UPDATE_SERVER_URL = 'https://liturgia-iasd.vercel.app/updates';
```

**Estrutura:**
```
public/
└── updates/
    ├── RELEASES
    └── liturgia-iasd-1.1.0-full.nupkg
```

#### Opção C: Servidor Próprio
Qualquer servidor HTTP que sirva arquivos estáticos:
- Apache
- Nginx
- IIS
- S3 + CloudFront

**Requisitos:**
- ✅ HTTPS (recomendado)
- ✅ CORS habilitado
- ✅ Arquivos acessíveis publicamente

## 📦 Processo de Atualização (Passo a Passo)

### Versão Atual: 1.0.0 → Nova Versão: 1.1.0

#### 1. Atualizar versão no package.json
```json
{
  "version": "1.1.0"
}
```

#### 2. Compilar nova versão
```bash
npm run dist
```

#### 3. Localizar arquivos gerados
```
out/make/squirrel.windows/x64/
├── LiturgiaIASD-1.1.0 Setup.exe      ← Para novos usuários
├── RELEASES                           ← Upload para servidor
└── liturgia-iasd-1.1.0-full.nupkg    ← Upload para servidor
```

#### 4. Upload para servidor
Faça upload de:
- ✅ `RELEASES` (substitui o anterior)
- ✅ `liturgia-iasd-1.1.0-full.nupkg` (novo arquivo)

**Importante:** Mantenha os `.nupkg` de versões anteriores para suportar updates incrementais!

```
updates/
├── RELEASES                           ← Sempre a versão mais recente
├── liturgia-iasd-1.0.0-full.nupkg    ← Versão antiga (manter)
└── liturgia-iasd-1.1.0-full.nupkg    ← Versão nova (adicionar)
```

#### 5. Usuários recebem update automaticamente
- Apps abertos verificam em até 4 horas
- Novos apps verificam em 3 segundos
- Download e instalação em background
- Notificação para reiniciar

## 🎨 Experiência do Usuário

### Quando há atualização disponível

1. **Notificação de download:**
   ```
   ┌─────────────────────────────────┐
   │ Atualização Disponível          │
   ├─────────────────────────────────┤
   │ Uma nova versão está sendo      │
   │ baixada em segundo plano.       │
   │                                 │
   │              [OK]               │
   └─────────────────────────────────┘
   ```

2. **Após download (pronto para instalar):**
   ```
   ┌─────────────────────────────────┐
   │ Atualização Pronta              │
   ├─────────────────────────────────┤
   │ Uma nova versão (1.1.0) foi     │
   │ instalada.                      │
   │                                 │
   │ Deseja reiniciar a aplicação    │
   │ agora para aplicar a atualização?│
   │                                 │
   │ Melhorias e correções de bugs. │
   │                                 │
   │  [Reiniciar Agora] [Depois]    │
   └─────────────────────────────────┘
   ```

### Verificação manual (Menu > Ajuda > Verificar Atualizações)

```
┌─────────────────────────────────┐
│ Verificando Atualizações        │
├─────────────────────────────────┤
│ Verificando se há atualizações  │
│ disponíveis...                  │
│                                 │
│              [OK]               │
└─────────────────────────────────┘
```

## 🔧 Configuração no Código

### Localização: `src/main.ts`

```typescript
// Configuração da URL do servidor
const UPDATE_SERVER_URL = 'https://liturgia-iasd.vercel.app/updates';

// Auto-update habilitado apenas em produção Windows
const AUTO_UPDATE_ENABLED = !USE_DEV && process.platform === 'win32';
```

### Personalizar comportamento

#### Alterar frequência de verificação
```typescript
// Verificar a cada 2 horas (ao invés de 4)
setInterval(() => {
  autoUpdater.checkForUpdates();
}, 2 * 60 * 60 * 1000); // 2 horas
```

#### Alterar delay inicial
```typescript
// Verificar após 10 segundos (ao invés de 3)
setTimeout(() => {
  autoUpdater.checkForUpdates();
}, 10000); // 10 segundos
```

#### Mostrar erros ao usuário
```typescript
autoUpdater.on('error', (error) => {
  // Descomentar para mostrar erros
  dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Erro na Atualização',
    message: 'Não foi possível verificar atualizações.',
    detail: error.message,
    buttons: ['OK']
  });
});
```

## 📊 Delta Updates (Updates Incrementais)

O Squirrel é inteligente e baixa apenas as **diferenças** entre versões:

```
Versão 1.0.0 → 1.1.0
├─ Arquivo A: Não mudou → Não baixa
├─ Arquivo B: Modificado → Baixa apenas diff
└─ Arquivo C: Novo → Baixa completo

Economia: ~70% de bandwidth!
```

**Como funciona:**
1. Squirrel compara hashes dos arquivos
2. Identifica apenas arquivos modificados
3. Baixa apenas o necessário
4. Aplica patches localmente

## 🐛 Troubleshooting

### Problema: "Auto-updater error"

**Causas comuns:**
1. ❌ Servidor inacessível
2. ❌ Arquivo RELEASES malformado
3. ❌ CORS bloqueado
4. ❌ URL incorreta

**Solução:**
```bash
# Testar URL manualmente
curl https://seu-servidor.com/updates/RELEASES

# Deve retornar algo como:
# A1B2C3... liturgia-iasd-1.1.0-full.nupkg 45678901
```

### Problema: "Update not available" (mas há nova versão)

**Causas:**
1. ❌ Versão no `package.json` não foi incrementada
2. ❌ Arquivo `RELEASES` não foi atualizado no servidor
3. ❌ Cache do navegador/CDN

**Solução:**
```bash
# 1. Verificar versão local
npm run build && electron . --version

# 2. Verificar arquivo RELEASES no servidor
curl https://seu-servidor.com/updates/RELEASES

# 3. Limpar cache (se usando CDN)
```

### Problema: Download trava

**Causas:**
1. ❌ Arquivo `.nupkg` muito grande
2. ❌ Conexão lenta
3. ❌ Servidor lento

**Solução:**
- Use CDN (CloudFront, Cloudflare)
- Comprima assets antes de compilar
- Monitore logs: `console.log` no evento `update-available`

## 📈 Monitoramento

### Logs úteis

```typescript
// No console da aplicação, você verá:
'Setting up auto-updater...'
'Update server: https://...'
'Checking for updates...'
'Update available! Downloading...'
'Update downloaded: 1.1.0'
'User chose to restart now'
```

### Métricas recomendadas

Se quiser analytics:
```typescript
autoUpdater.on('update-downloaded', () => {
  // Enviar para analytics
  fetch('https://seu-analytics.com/track', {
    method: 'POST',
    body: JSON.stringify({
      event: 'update_downloaded',
      version: app.getVersion()
    })
  });
});
```

## ✅ Checklist de Deploy

Antes de lançar uma atualização:

- [ ] Incrementar versão no `package.json`
- [ ] Testar localmente (`npm run dev`)
- [ ] Compilar (`npm run dist`)
- [ ] Testar instalador gerado
- [ ] Upload `RELEASES` para servidor
- [ ] Upload `.nupkg` para servidor
- [ ] Verificar URL acessível
- [ ] Testar update em app antigo
- [ ] Monitorar logs de erro

## 🚀 Exemplo Completo (GitHub Releases)

### 1. Configurar URL
```typescript
// src/main.ts
const UPDATE_SERVER_URL = 'https://github.com/seu-usuario/liturgia-iasd-desktop/releases/latest/download';
```

### 2. Criar release no GitHub
```bash
# Via GitHub CLI
gh release create v1.1.0 \
  --title "Versão 1.1.0" \
  --notes "Melhorias e correções" \
  out/make/squirrel.windows/x64/RELEASES \
  out/make/squirrel.windows/x64/liturgia-iasd-1.1.0-full.nupkg
```

### 3. Pronto!
Apps existentes receberão a atualização automaticamente.

## 🎓 Recursos Adicionais

- [Documentação Squirrel.Windows](https://github.com/Squirrel/Squirrel.Windows)
- [Electron autoUpdater API](https://www.electronjs.org/docs/latest/api/auto-updater)
- [Electron Builder vs Forge](https://www.electron.build/auto-update)

---

## 💡 Dicas Finais

1. **Sempre teste updates localmente** antes de publicar
2. **Mantenha versões antigas** no servidor (para delta updates)
3. **Use HTTPS** sempre que possível
4. **Monitore erros** em produção
5. **Comunique mudanças** nas release notes
