// ================================================================
// SISTEMA DE GERENCIAMENTO DE ÁUDIO - MATHLENS
// ================================================================

(function() {
    class AudioManager {
        constructor() {
            this.unlocked = false;
            this.currentBgm = null;
            
            // Controle da trilha aleatória do Boss
            this.inBossFight = false;
            this.currentBossAudio = null;
            this.bossTimer = null;
            this.lastBossIndex = -1;

            // Controle de voz (com corte rigoroso em 3 segundos)
            this.currentVoice = null;
            this.voiceTimer = null;

            // Sons mapeados
            this.sounds = {
                menu: new Audio('html5game/sound/menu.mp3'),
                paiFala: new Audio('html5game/sound/Paifalando.mp3'),
                filhoFala: new Audio('html5game/sound/filhofalando.mp3'),
                draFala: new Audio('html5game/sound/dra_falando.mp3'),
                coleta: new Audio('html5game/sound/coletandoItens.mp3'),
                cura: new Audio('html5game/sound/Securando.mp3'),
                teclaK: new Audio('html5game/sound/QuandoclicarnateclaK.mp3'),
                transicao: new Audio('html5game/sound/passando_de_uma_sala_para_outra.mp3'),
                checkpoint: new Audio('html5game/sound/usando_e_ligando_o_chekpoint.mp3'),
                dano: new Audio('html5game/sound/sTomandodano.mp3'),
                fa: new Audio('html5game/sound/fa.mp3'),
                bossMudaSprite: new Audio('html5game/sound/2partedoboss_sempreque_elemudadesprite.mp3'),
                bossMorte: new Audio('html5game/sound/morte_do_boss.mp3'),
                approved: new Audio('html5game/sound/approved.mp3'),
                gameOver: new Audio('html5game/sound/game-over.mp3')
            };

            // Lista de áudios que tocam aleatoriamente no Boss (sem tocar juntos!)
            this.bossRandomPlaylist = [
                { name: 'Boss Aleatório 1', audio: new Audio('html5game/sound/tocaraleatoriamentenoboss.mp3'), volume: 0.8 },
                { name: 'Boss Music Box', audio: new Audio('html5game/sound/tocaraletoriamentnobosspt2_Music_Box.mp3'), volume: 0.6 },
                { name: 'Boss Puptyt', audio: new Audio('html5game/sound/puptyt.mp3'), volume: 0.6 }
            ];

            // Configuração dos loops: NENHUM SFX EM LOOP, apenas o menu
            this.sounds.menu.loop = true;
            this.sounds.gameOver.loop = false;
            this.sounds.approved.loop = false;
            this.sounds.bossMorte.loop = false;

            // Volumes padrão
            this.sounds.menu.volume = 0.5;
            this.sounds.dano.volume = 0.9;
            this.sounds.fa.volume = 1.0;
            this.sounds.teclaK.volume = 0.9;
            this.sounds.coleta.volume = 0.7;
            this.sounds.cura.volume = 0.8;
            this.sounds.bossMorte.volume = 0.9;
            this.sounds.approved.volume = 1.0;
            this.sounds.gameOver.volume = 0.95;
            this.sounds.checkpoint.volume = 0.85;
            this.sounds.transicao.volume = 0.8;
            this.sounds.bossMudaSprite.volume = 0.85;

            // Desbloqueio de áudio pelo clique/teclado do navegador
            this.setupUnlock();
            this.setupKeyK();

            console.log("[AudioManager] Módulo inicializado com sucesso.");
        }

        setupUnlock() {
            const unlock = () => {
                if (this.unlocked) return;
                this.unlocked = true;
                console.log("[AudioManager] Áudio desbloqueado por interação.");

                if (!this.currentBgm && !this.inBossFight) {
                    this.playMenu();
                }

                window.removeEventListener('click', unlock);
                window.removeEventListener('keydown', unlock);
                window.removeEventListener('touchstart', unlock);
            };

            window.addEventListener('click', unlock);
            window.addEventListener('keydown', unlock);
            window.addEventListener('touchstart', unlock);
        }

        setupKeyK() {
            window.addEventListener('keydown', (e) => {
                if (e.key === 'k' || e.key === 'K') {
                    console.log("[AudioManager] Tecla K pressionada!");
                    this.playTeclaK();
                }
            });
        }

        // ================================================================
        // --- PARAR TODOS OS SONS (CORTE TOTAL EM TRANSIÇÕES E MORTE) ---
        // ================================================================
        stopAllSounds() {
            // 1. Corta qualquer voz ativa imediatamente
            this.stopVoice();

            // 2. Para timers e áudios do Boss
            if (this.bossTimer) {
                clearTimeout(this.bossTimer);
                this.bossTimer = null;
            }
            if (this.currentBossAudio) {
                try {
                    this.currentBossAudio.pause();
                    this.currentBossAudio.currentTime = 0;
                } catch(e) {}
                this.currentBossAudio = null;
            }

            // 3. Para fade e música de fundo
            if (this.fadeInterval) {
                clearInterval(this.fadeInterval);
                this.fadeInterval = null;
            }
            this.stopBgm();

            // 4. Pausa todos os outros sons cadastrados
            Object.values(this.sounds).forEach(s => {
                try {
                    s.pause();
                    s.currentTime = 0;
                } catch(e) {}
            });
            this.bossRandomPlaylist.forEach(item => {
                try {
                    item.audio.pause();
                    item.audio.currentTime = 0;
                } catch(e) {}
            });
        }

        // Chamado sempre que o jogo muda de sala (transição de cena)
        onRoomChange() {
            console.log("[AudioManager] 🚪 Transição de cena detectada!");
            // Se o approved estiver tocando pela vitória do boss, não corta!
            const wasPlayingApproved = !this.sounds.approved.paused && !this.sounds.approved.ended && this.sounds.approved.currentTime > 0;
            this.stopAllSounds();
            if (wasPlayingApproved) {
                try {
                    this.sounds.approved.play().catch(e => {});
                } catch(e) {}
            } else {
                this.playSfx(this.sounds.transicao);
            }
        }

        // ================================================================
        // --- MORTE DO BOSS (VITÓRIA / APROVADO) ---
        // ================================================================
        playApproved() {
            this.playBossMorte();
        }

        playBossMorte() {
            console.log("[AudioManager] 🏆 VITÓRIA DO BOSS! Silenciando tudo e tocando approved.mp3");
            this.stopAllSounds();
            try {
                this.sounds.approved.loop = false;
                this.sounds.approved.currentTime = 0;
                this.sounds.approved.volume = 1.0;
                const p = this.sounds.approved.play();
                if (p !== undefined) {
                    p.then(() => {
                        console.log("[AudioManager] ✅ approved.mp3 tocando com sucesso!");
                    }).catch(e => {
                        console.error("[AudioManager] Erro ao reproduzir approved.mp3:", e);
                    });
                }
            } catch(e) {
                console.error("[AudioManager] Falha ao disparar approved:", e);
            }
        }

        // ================================================================
        // --- SISTEMA DE FALA (LIMITADO A NO MÁXIMO 3 SEGUNDOS) ---
        // ================================================================
        playVoice(audioObj) {
            // Corta fala anterior se houver
            this.stopVoice();

            this.currentVoice = audioObj;
            try {
                audioObj.currentTime = 0;
                audioObj.play().catch(e => console.log("Voice play error:", e));

                // REGRA: Corta o áudio em no máximo 3 segundos!
                this.voiceTimer = setTimeout(() => {
                    this.stopVoice();
                }, 3000);
            } catch(e) {}
        }

        stopVoice() {
            if (this.voiceTimer) {
                clearTimeout(this.voiceTimer);
                this.voiceTimer = null;
            }
            if (this.currentVoice) {
                try {
                    this.currentVoice.pause();
                    this.currentVoice.currentTime = 0;
                } catch(e) {}
                this.currentVoice = null;
            }
        }

        playPaiFala() {
            this.playVoice(this.sounds.paiFala);
        }

        playFilhoFala() {
            this.playVoice(this.sounds.filhoFala);
        }

        playDraFala() {
            this.playVoice(this.sounds.draFala);
        }

        // ================================================================
        // --- SFX GERAIS ---
        // ================================================================
        playSfx(audioObj) {
            try {
                const s = audioObj.cloneNode();
                s.volume = audioObj.volume;
                s.play().catch(e => {});
            } catch(e) {
                try {
                    audioObj.currentTime = 0;
                    audioObj.play().catch(e => {});
                } catch(err) {}
            }
        }

        playColeta() {
            this.playSfx(this.sounds.coleta);
        }

        playCura() {
            this.playSfx(this.sounds.cura);
        }

        playTeclaK() {
            this.playSfx(this.sounds.teclaK);
        }

        playTransicao() {
            this.stopAllSounds();
            this.playSfx(this.sounds.transicao);
        }

        playCheckpoint() {
            this.playSfx(this.sounds.checkpoint);
        }

        playBossMudaSprite() {
            this.playSfx(this.sounds.bossMudaSprite);
        }

        // ================================================================
        // --- DANO NO LÉO (1 EM 10 DE CHANCE DE 'fa.mp3') ---
        // ================================================================
        playDanoPlayer() {
            const sorteio = Math.random();
            if (sorteio < 0.10) {
                console.log("[AudioManager] 🎲 Sorteado 'fa.mp3' (Chance 1 em 10)!");
                this.playSfx(this.sounds.fa);
            } else {
                this.playSfx(this.sounds.dano);
            }
        }

        // ================================================================
        // --- MÚSICA DO MENU ---
        // ================================================================
        playMenu() {
            if (this.inBossFight) return;
            if (this.currentBgm === this.sounds.menu) return;
            this.stopBgm();
            this.currentBgm = this.sounds.menu;
            this.sounds.menu.currentTime = 0;
            this.sounds.menu.play().catch(e => {});
        }

        stopMenu() {
            if (this.currentBgm === this.sounds.menu) {
                this.stopBgm();
            }
        }

        stopBgm() {
            if (this.currentBgm) {
                try {
                    this.currentBgm.pause();
                    this.currentBgm.currentTime = 0;
                } catch(e) {}
                this.currentBgm = null;
            }
        }

        // ================================================================
        // --- GERENCIADOR DO BOSS FINAL ---
        // ================================================================
        startBossFight() {
            if (this.inBossFight) return;
            console.log("[AudioManager] ⚔️ Batalha do Boss iniciada!");
            this.inBossFight = true;

            // Fade out gradual da música do menu (abaixa gradualmente até silêncio total em 3s)
            this.fadeOutMenu(3000);

            // Agenda o primeiro som aleatório do Boss após um momento de suspense (4 a 6 segundos)
            this.scheduleNextBossAudio(4000, 6000);
        }

        fadeOutMenu(durationMs = 3000) {
            if (!this.currentBgm) return;
            const bgm = this.currentBgm;
            const startVolume = bgm.volume;
            const intervalMs = 50;
            const totalSteps = durationMs / intervalMs;
            const volStep = startVolume / totalSteps;

            console.log("[AudioManager] 📉 Iniciando fade-out da música do menu...");

            if (this.fadeInterval) {
                clearInterval(this.fadeInterval);
                this.fadeInterval = null;
            }

            this.fadeInterval = setInterval(() => {
                if (bgm.volume > volStep) {
                    bgm.volume = Math.max(0, bgm.volume - volStep);
                } else {
                    bgm.volume = 0;
                    bgm.pause();
                    bgm.currentTime = 0;
                    bgm.volume = 0.5;
                    clearInterval(this.fadeInterval);
                    this.fadeInterval = null;
                    if (this.currentBgm === bgm) {
                        this.currentBgm = null;
                    }
                    console.log("[AudioManager] 🔇 Música do menu atingiu silêncio total!");
                }
            }, intervalMs);
        }

        scheduleNextBossAudio(minMs = 7000, maxMs = 14000) {
            if (!this.inBossFight) return;

            if (this.bossTimer) {
                clearTimeout(this.bossTimer);
                this.bossTimer = null;
            }

            const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
            console.log(`[AudioManager] Próximo áudio do Boss em ${(delay/1000).toFixed(1)}s`);

            this.bossTimer = setTimeout(() => {
                this.playNextBossAudio();
            }, delay);
        }

        playNextBossAudio() {
            if (!this.inBossFight) return;

            let nextIndex = Math.floor(Math.random() * this.bossRandomPlaylist.length);
            if (this.bossRandomPlaylist.length > 1 && nextIndex === this.lastBossIndex) {
                nextIndex = (nextIndex + 1) % this.bossRandomPlaylist.length;
            }
            this.lastBossIndex = nextIndex;

            const item = this.bossRandomPlaylist[nextIndex];
            console.log(`[AudioManager] 🎵 Tocando no Boss: ${item.name}`);

            this.currentBossAudio = item.audio;
            this.currentBossAudio.volume = item.volume;
            this.currentBossAudio.currentTime = 0;

            const onEnded = () => {
                this.currentBossAudio.removeEventListener('ended', onEnded);
                this.currentBossAudio = null;
                if (this.inBossFight) {
                    this.scheduleNextBossAudio(7000, 14000);
                }
            };

            this.currentBossAudio.addEventListener('ended', onEnded);
            this.currentBossAudio.play().catch(e => {
                this.scheduleNextBossAudio(5000, 8000);
            });
        }

        stopBossFight() {
            this.inBossFight = false;
            if (this.bossTimer) {
                clearTimeout(this.bossTimer);
                this.bossTimer = null;
            }
            if (this.currentBossAudio) {
                try {
                    this.currentBossAudio.pause();
                    this.currentBossAudio.currentTime = 0;
                } catch(e) {}
                this.currentBossAudio = null;
            }
        }



        // ================================================================
        // --- GAME OVER (REPROVAÇÃO / MORTE DO JOGADOR) ---
        // Cancela e silencia TODOS os outros áudios, toca apenas game-over SEM loop!
        // ================================================================
        playGameOver() {
            console.log("[AudioManager] 💀 REPROVADO / GAME OVER - Silenciando todos os sons e tocando game-over.mp3 (sem loop)");
            this.stopAllSounds();
            this.sounds.gameOver.loop = false;
            this.sounds.gameOver.currentTime = 0;
            this.sounds.gameOver.play().catch(e => {});
        }

        // Encerramento do jogo pós-conversa com a doutora
        playFimDeJogo() {
            console.log("[AudioManager] 🎬 Fim de jogo pós-Doutora: tocando tocaraleatoriamentenoboss.mp3");
            this.stopAllSounds();
            this.playSfx(this.bossRandomPlaylist[0].audio);
        }
    }

    window.AudioManager = new AudioManager();
})();
