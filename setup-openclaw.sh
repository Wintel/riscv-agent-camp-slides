#!/usr/bin/env bash
# =============================================================================
#  学森暑期营 · 一键在 RISC-V 板子上配置 OpenClaw + DeepSeek
#
#  用法（在板子上跑，不是在你自己的电脑上）：
#      bash setup-openclaw.sh
#
#  跑完你会得到：
#      1) 一个装好的 OpenClaw，连着你自己的 DeepSeek 账号
#      2) 一个在后台运行的 Gateway（板子的"管家"进程）
#      3) 屏幕上打印出：怎么从你自己的电脑连上它
#
#  这个脚本可以重复跑。已经装好的部分会自动跳过，不会重来一遍。
# =============================================================================

set -euo pipefail

# ---------- 可调参数（一般不用改）----------
NODE_VERSION="v24.18.0"
NODE_MIRROR="https://registry.npmmirror.com/-/binary/node-unofficial-builds"
NPM_REGISTRY="https://registry.npmmirror.com"
GATEWAY_PORT="${OC_PORT:-18789}"

ENV_DIR="$HOME/openclaw-env"
NODE_DIR="$ENV_DIR/node-${NODE_VERSION}-linux-riscv64"
PREFIX_DIR="$ENV_DIR/prefix"
LOG_FILE="$ENV_DIR/gateway.log"

# ---------- 好看一点的输出 ----------
if [ -t 1 ]; then
  B=$'\033[1m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; C=$'\033[36m'; N=$'\033[0m'
else
  B=""; G=""; Y=""; R=""; C=""; N=""
fi
step()  { echo; echo "${B}${C}▶ $*${N}"; }
ok()    { echo "  ${G}✔${N} $*"; }
skip()  { echo "  ${Y}⏭${N} $*"; }
warn()  { echo "  ${Y}⚠${N} $*"; }
die()   { echo; echo "${R}✗ 出错了：$*${N}"; echo "  把上面这段红字截图发给老师，或看手册最后的「卡住了怎么办」。"; exit 1; }

echo "${B}=====================================================${N}"
echo "${B}  OpenClaw 一键配置 · 学森暑期营${N}"
echo "${B}=====================================================${N}"

# =============================================================================
# 第 0 步：检查这台机器对不对
# =============================================================================
step "第 0 步 / 共 8 步：检查环境"

ARCH="$(uname -m)"
if [ "$ARCH" != "riscv64" ]; then
  warn "当前架构是 $ARCH，不是 riscv64。"
  warn "这个脚本是给板子用的——你是不是在自己的电脑上跑了？"
  warn "请先 ssh 连上板子，再在板子里跑本脚本。"
  die "架构不对，已停止。"
fi
ok "架构 riscv64，是板子没错"

command -v curl >/dev/null 2>&1 || die "板子上没有 curl，请先装：sudo apt install -y curl"
ok "curl 有了"

if curl -s -o /dev/null --max-time 15 https://api.deepseek.com/models; then
  ok "能连上 DeepSeek 的服务器"
else
  die "连不上 api.deepseek.com。检查板子网线/网络后重试。"
fi

mkdir -p "$ENV_DIR"

# =============================================================================
# 第 1 步：装 Node 24（OpenClaw 的运行底座）
# =============================================================================
step "第 1 步 / 共 8 步：准备 Node 24"

if [ -x "$NODE_DIR/bin/node" ]; then
  skip "Node ${NODE_VERSION} 已经装过了"
else
  echo "  正在下载 Node ${NODE_VERSION}（约 30 MB，用国内镜像，通常十几秒）…"
  TARBALL="$ENV_DIR/node.tar.xz"
  curl -fL --silent --show-error --max-time 600 \
    "${NODE_MIRROR}/${NODE_VERSION}/node-${NODE_VERSION}-linux-riscv64.tar.xz" \
    -o "$TARBALL" || die "Node 下载失败，检查网络后重跑本脚本。"
  tar -xf "$TARBALL" -C "$ENV_DIR" || die "Node 解压失败，删掉 $ENV_DIR 后重跑。"
  rm -f "$TARBALL"
  [ -x "$NODE_DIR/bin/node" ] || die "解压出来的目录名不对，请把 $ENV_DIR 的内容发给老师。"
  ok "Node 装好了"
fi

# 从这里开始，本脚本内部都用这套 node
export PATH="$NODE_DIR/bin:$PREFIX_DIR/bin:$PATH"
ok "node $(node --version) · npm $(npm --version)"

# =============================================================================
# 第 2 步：装 OpenClaw 本体
# =============================================================================
step "第 2 步 / 共 8 步：安装 OpenClaw"

mkdir -p "$PREFIX_DIR"
npm config set prefix "$PREFIX_DIR" >/dev/null
npm config set registry "$NPM_REGISTRY" >/dev/null
ok "npm 已切到国内镜像"

if command -v openclaw >/dev/null 2>&1 && openclaw --version >/dev/null 2>&1; then
  skip "OpenClaw 已经装过了（$(openclaw --version 2>/dev/null | head -1)）"
else
  echo "  正在安装，板子上大约需要 1 分钟，请耐心等…"
  # npm 出于安全默认拦下依赖包的安装脚本，先放行再装，省得装完还要补一次
  npm config set dangerously-allow-all-scripts true >/dev/null
  npm install -g openclaw@latest >/dev/null 2>&1 || die "OpenClaw 安装失败，重跑一次本脚本试试。"
  npm config set dangerously-allow-all-scripts false >/dev/null
  command -v openclaw >/dev/null 2>&1 || die "装完了却找不到 openclaw 命令，请找老师。"
  ok "OpenClaw 装好了（$(openclaw --version 2>/dev/null | head -1)）"
fi

# =============================================================================
# 第 3 步：让你下次登录也能直接用 openclaw 命令
# =============================================================================
step "第 3 步 / 共 8 步：把 openclaw 加进你的命令行"

PATH_LINE="export PATH=\"$NODE_DIR/bin:$PREFIX_DIR/bin:\$PATH\"   # OpenClaw"
if grep -qF "$NODE_DIR/bin" "$HOME/.bashrc" 2>/dev/null; then
  skip "之前已经加过了"
else
  printf '\n# ---- OpenClaw（学森暑期营一键脚本添加）----\n%s\n' "$PATH_LINE" >> "$HOME/.bashrc"
  ok "已写入 ~/.bashrc，下次 ssh 登录直接敲 openclaw 就行"
fi

# =============================================================================
# 第 4 步：装 DeepSeek 插件
# =============================================================================
step "第 4 步 / 共 8 步：装 DeepSeek 插件"

if openclaw plugins list 2>/dev/null | grep -qi deepseek; then
  skip "DeepSeek 插件已经装过了"
else
  openclaw plugins install @openclaw/deepseek-provider >/dev/null 2>&1 \
    || die "DeepSeek 插件安装失败，重跑一次试试。"
  ok "DeepSeek 插件装好了"
fi

# =============================================================================
# 第 5 步：填入你自己的 API key
# =============================================================================
step "第 5 步 / 共 8 步：填入你的 DeepSeek API key"

# 判断依据是「模型真的可用」（models list 里带 configured 标记），
# 不能只看配置文件里有没有 deepseek 字样——装插件也会写进那个字样
if openclaw models list 2>/dev/null | grep -qi 'deepseek.*configured'; then
  skip "已经配过 DeepSeek 了（想换 key 就删掉 ~/.openclaw 再跑一次本脚本）"
else
  # 支持两种给 key 的方式：环境变量（老师批量部署）或手动粘贴（同学自己装）
  if [ -z "${DEEPSEEK_API_KEY:-}" ]; then
    echo "  请粘贴你在 platform.deepseek.com 创建的 API key，"
    echo "  它以 ${C}sk-${N} 开头。${Y}粘贴时屏幕上不会显示任何字符，这是正常的${N}（防止被旁边同学看到）。"
    echo "  粘好之后直接按回车。"
    printf "  API key: "
    read -rs DEEPSEEK_API_KEY
    echo
  fi

  case "${DEEPSEEK_API_KEY:-}" in
    sk-*) : ;;
    "")   die "你没有输入 key。回到手册第 1 步，先去办一把钥匙。" ;;
    *)    die "这不像一把 DeepSeek 的 key（应该以 sk- 开头）。请重新复制一次。" ;;
  esac

  echo "  正在验证这把钥匙能不能用…"
  HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
      https://api.deepseek.com/models \
      -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" || echo 000)"
  case "$HTTP_CODE" in
    200) ok "钥匙有效" ;;
    401|403) die "DeepSeek 说这把钥匙无效（HTTP $HTTP_CODE）。请回官网确认 key 复制完整。" ;;
    000) die "网络不通，没连上 DeepSeek。检查网络后重跑。" ;;
    *)   warn "DeepSeek 返回了 HTTP $HTTP_CODE，先继续，出问题再找老师。" ;;
  esac

  openclaw onboard --non-interactive \
    --mode local \
    --auth-choice deepseek-api-key \
    --deepseek-api-key "$DEEPSEEK_API_KEY" \
    --skip-health --accept-risk >/dev/null 2>&1 \
    || die "初始化失败。删掉 ~/.openclaw 后重跑本脚本。"
  unset DEEPSEEK_API_KEY
  ok "DeepSeek 配好了，默认模型 deepseek-v4-flash"
fi

# =============================================================================
# 第 6 步：设置管家进程的门锁
# =============================================================================
step "第 6 步 / 共 8 步：给 Gateway 配一把门锁"

# 只监听板子本机（loopback）。外面进不来，我们靠 SSH 隧道访问——这样最安全。
openclaw config set gateway.mode local        >/dev/null 2>&1 || true
openclaw config set gateway.bind loopback     >/dev/null 2>&1 || true
openclaw config set gateway.port "$GATEWAY_PORT" >/dev/null 2>&1 || true
openclaw config set gateway.auth.mode token   >/dev/null 2>&1 || true
openclaw config set plugins.allow '["deepseek"]' >/dev/null 2>&1 || true

TOKEN_FILE="$ENV_DIR/gateway-token.txt"
if [ -s "$TOKEN_FILE" ]; then
  GW_TOKEN="$(cat "$TOKEN_FILE")"
  skip "沿用上次生成的门锁口令"
else
  GW_TOKEN="$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  printf '%s' "$GW_TOKEN" > "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"
  ok "生成了一把随机口令（存在 $TOKEN_FILE）"
fi
openclaw config set gateway.auth.token "$GW_TOKEN" >/dev/null 2>&1 \
  || die "写入门锁口令失败。"
ok "门锁配好了（只允许本机访问，外部必须走 SSH 隧道）"

# =============================================================================
# 第 7 步：启动管家进程
# =============================================================================
step "第 7 步 / 共 8 步：启动 Gateway"

port_busy() { ss -tln 2>/dev/null | grep -q ":${GATEWAY_PORT} "; }

if port_busy; then
  echo "  端口 ${GATEWAY_PORT} 上已经有一个 Gateway 在跑，先把它停掉换成新配置…"
  # 注意：不能用 pkill -f openclaw，那会把你自己的 ssh 会话一起杀掉
  OLD_PID="$(ss -tlnp 2>/dev/null | grep ":${GATEWAY_PORT} " | grep -oP 'pid=\K[0-9]+' | head -1 || true)"
  [ -n "$OLD_PID" ] && kill "$OLD_PID" 2>/dev/null || true
  sleep 3
fi

nohup openclaw gateway run > "$LOG_FILE" 2>&1 &
echo -n "  正在启动"
for _ in $(seq 1 40); do
  if port_busy; then break; fi
  echo -n "."
  sleep 1
done
echo

if port_busy; then
  ok "Gateway 跑起来了（日志在 $LOG_FILE）"
else
  echo
  echo "  ${R}Gateway 没能启动，最后几行日志：${N}"
  tail -n 15 "$LOG_FILE" 2>/dev/null | sed 's/^/    /'
  die "启动失败，把上面的日志发给老师。"
fi

# =============================================================================
# 第 8 步：自检——真的问它一句话
# =============================================================================
step "第 8 步 / 共 8 步：自检（真的问它一句话，约 20 秒）"

ANSWER="$(openclaw agent --agent main --timeout 120 \
          -m '只回答两个字：收到' 2>/dev/null | tail -3 || true)"
if [ -n "$ANSWER" ]; then
  ok "它回话了：${G}${ANSWER}${N}"
else
  warn "自检没拿到回答。Gateway 是活的，但对话可能有问题——"
  warn "先往下看连接方式，如果网页里也不回话，就找老师。"
fi

# =============================================================================
# 完成，告诉学生下一步怎么做
# =============================================================================
BOARD_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
BOARD_USER="$(whoami)"
[ -z "$BOARD_IP" ] && BOARD_IP="板子的IP"

cat <<EOF

${B}=====================================================${N}
${G}${B}  🎉 装好了！下面两步在「你自己的电脑」上做${N}
${B}=====================================================${N}

${B}第 1 步：开一条隧道${N}
  在你自己的电脑上${B}新开一个${N}终端（Windows 用 PowerShell，Mac 用「终端」），
  粘贴这一行并回车，输入板子密码后，${Y}让这个窗口一直开着别关${N}：

      ${C}ssh -L ${GATEWAY_PORT}:127.0.0.1:${GATEWAY_PORT} ${BOARD_USER}@${BOARD_IP}${N}

${B}第 2 步：打开网页${N}
  在你自己电脑的浏览器里打开这个地址（${Y}#token= 那一长串不能少${N}）：

      ${C}http://localhost:${GATEWAY_PORT}/#token=${GW_TOKEN}${N}

  看到聊天界面、左下角是绿点，就成功了。开始跟它说话吧！

${B}也可以不开网页，直接在板子上聊：${N}
      ${C}openclaw agent --agent main -m "这块板子的 CPU 温度多少？"${N}

${B}小抄${N}（这些信息随时可以回来看）：
  · 门锁口令存在：${TOKEN_FILE}
  · Gateway 日志：  ${LOG_FILE}
  · 重启 Gateway：  再跑一次本脚本即可
  · ${Y}千万别用 pkill -f openclaw${N}（会把你自己的 ssh 连接一起杀掉）

EOF
