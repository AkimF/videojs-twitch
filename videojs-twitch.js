(function (root, factory) {
    if(typeof exports==='object' && typeof module!=='undefined') {
        module.exports = factory(require('video.js'));
    } else if(typeof define === 'function' && define.amd) {
        define(['videojs'], function(videojs){
            return (root.twitch = factory(videojs));
        });
    } else {
        root.twitch = factory(root.videojs);
    }
}(this, function(videojs) {
    'use strict';

    var _isOnMobile = videojs.browser.IS_IOS || videojs.browser.IS_ANDROID;
    var Tech = videojs.getTech('Tech');

    var twitch = videojs.extend(Tech, {

        constructor: function(options, ready) {
            Tech.call(this, options, ready);

            this.setSrc(this.options_.source, true);

            this.setTimeout(function() {
                if (this.el_) {
                    this.el_.parentNode.className += ' vjs-twitch';

                    if (_isOnMobile) {
                        this.el_.parentNode.className += ' vjs-twitch-mobile';
                    }

                    if (twitch.isApiReady) {
                        this.initTwitchPlayer();
                    } else {
                        twitch.apiReadyQueue.push(this);
                    }
                }
            }.bind(this));
        },

        dispose: function() {
            if (this.twitchPlayer) {
                if (this.twitchPlayer.stop) {
                    this.twitchPlayer.stop();
                }
                if (this.twitchPlayer.destroy) {
                    this.twitchPlayer.destroy();
                }
            } else {
                var index = twitch.apiReadyQueue.indexOf(this);
                if (index !== -1) {
                    twitch.apiReadyQueue.splice(index, 1);
                }
            }
            this.twitchPlayer = null;

            this.el_.parentNode.className = this.el_.parentNode.className
                .replace(' vjs-twitch', '')
                .replace(' vjs-twitch-mobile', '');
            this.el_.parentNode.removeChild(this.el_);

            Tech.prototype.dispose.call(this);
        },

        createEl: function() {
            var div = document.createElement('div');
            div.setAttribute('id', this.options_.techId);
            div.setAttribute('style', 'width:100%;height:100%;top:0;left:0;position:absolute');
            div.setAttribute('class', 'vjs-tech');

            var divWrapper = document.createElement('div');
            divWrapper.appendChild(div);

            if (!_isOnMobile && !this.options_.dmControls) {
                var divBlocker = document.createElement('div');
                divBlocker.setAttribute('class', 'vjs-iframe-blocker');
                divBlocker.setAttribute('style', 'position:absolute;top:0;left:0;width:100%;height:100%');

                divBlocker.onclick = function() {
                    this.pause();
                }.bind(this);

                divWrapper.appendChild(divBlocker);
            }

            return divWrapper;
        },

        initTwitchPlayer: function() {
            this.activeVideoId = this.videoId ? this.videoId : null;

            this.twitchPlayer = new Twitch.Player(this.options_.techId, {
                video: this.videoId,
                width: '100%',
                height: '100%',
                controls: false,
            });

            this.twitchPlayer.addEventListener(Twitch.Player.READY, this.onPlayerReady.bind(this));
            this.twitchPlayer.addEventListener(Twitch.Player.PLAYING, this.onPlaying.bind(this));
            this.twitchPlayer.addEventListener(Twitch.Player.PLAY, this.onPlay.bind(this));
            this.twitchPlayer.addEventListener(Twitch.Player.PAUSE, this.onPause.bind(this));
            this.twitchPlayer.addEventListener(Twitch.Player.ENDED, this.onEnded.bind(this));
        },

        onPlayerReady: function() {
            if (this.options_.muted) {
                this.twitchPlayer.setMuted(true);
            }

            this.lastState = 'ready';
            this.playerReady_ = true;
            this.triggerReady();

            if (this.playOnReady) {
                this.play();
            } else if (this.cueOnReady) {
                this.activeVideoId = this.videoId;
            }
        },

        onPlaying: function(e) {
            if ('playing' === this.lastState) {
                return;
            }

            this.lastState = 'playing';

            this.trigger('timeupdate');
            this.trigger('durationchange');
            this.trigger('playing');
            this.trigger('play');
        },

        onPlay: function() {
            if ('play' === this.lastState) {
                return;
            }

            this.lastState = 'play';
            this.trigger('play');
        },

        onPause: function() {
            if ('pause' === this.lastState) {
                return;
            }

            this.lastState = 'pause';
            this.trigger('pause');
        },

        onEnded: function() {
            if ('ended' === this.lastState) {
                return;
            }

            this.lastState = 'ended';
            this.trigger('ended');
        },

        onPlayerVolumeChange: function() {
            this.trigger('volumechange');
        },

        onPlayerError: function(e) {
            this.errorNumber = e.data;
            this.trigger('pause');
            this.trigger('error');
        },

        error: function() {
            var code = 1000 + this.errorNumber;
            switch (this.errorNumber) {
                case 5:
                    return { code: code, message: 'Error while trying to play the video' };

                case 2:
                case 100:
                    return { code: code, message: 'Unable to find the video' };

                case 101:
                case 150:
                    return {
                        code: code,
                        message: 'Playback on other Websites has been disabled by the video owner.'
                    };
            }

            return { code: code, message: 'Twitch unknown error (' + this.errorNumber + ')' };
        },

        src: function(src) {
            if (src) {
                this.setSrc({ src: src });
            }

            return this.source;
        },

        setSrc: function(source) {
            if (!source || !source.src) {
                return;
            }

            this.source = source;
            this.videoId = twitch.parseUrl(source.src);

            if (this.options_.autoplay && !_isOnMobile) {
                if (this.isReady_) {
                    this.play();
                } else {
                    this.playOnReady = true;
                }
            }
        },

        poster: function() {
            if (_isOnMobile) {
                return null;
            }

            return this.poster_;
        },

        setPoster: function(poster) {

        },

        autoplay: function() {
            return this.options_.autoplay;
        },

        setAutoplay: function(val) {
            this.options_.autoplay = val;
        },

        loop: function() {
            return this.options_.loop;
        },

        setLoop: function(val) {
            this.options_.loop = val;
        },

        play: function() {
            if (!this.videoId) {
                return;
            }

            this.wasPausedBeforeSeek = false;

            if (this.isReady_) {
                if (this.activeVideoId === this.videoId) {
                    this.twitchPlayer.play();
                } else {
                    this.activeVideoId = this.videoId;
                }
            } else {
                this.trigger('waiting');
                this.playOnReady = true;
            }
        },

        pause: function() {
            if (this.twitchPlayer) {
                this.twitchPlayer.pause();
            }
        },

        paused: function() {
            return this.twitchPlayer.isPaused();
        },

        currentTime: function() {
            return this.twitchPlayer ? this.twitchPlayer.getCurrentTime() : 0;
        },

        setCurrentTime: function(seconds) {
            if (this.lastState === 'pause') {
                this.timeBeforeSeek = this.currentTime();
            }

            if (!this.isSeeking) {
                this.wasPausedBeforeSeek = this.paused();
            }

            this.twitchPlayer.seek(seconds);
            this.trigger('timeupdate');
            this.isSeeking = true;

            if (this.lastState === 'pause' && this.timeBeforeSeek !== seconds) {
                clearInterval(this.checkSeekedInPauseInterval);
                this.checkSeekedInPauseInterval = setInterval(function() {
                    if (this.lastState !== 'pause' || !this.isSeeking) {
                        clearInterval(this.checkSeekedInPauseInterval);
                    } else if (this.currentTime() !== this.timeBeforeSeek) {
                        this.trigger('timeupdate');
                        this.onSeeked();
                    }
                }.bind(this), 250);
            }
        },

        seeking: function () {
            return this.isSeeking;
        },

        seekable: function () {
            if(!this.twitchPlayer) {
                return videojs.createTimeRange();
            }
            return videojs.createTimeRange(0, this.twitchPlayer.getDuration());
        },

        onSeeked: function() {
            clearInterval(this.checkSeekedInPauseInterval);
            this.isSeeking = false;

            if (this.wasPausedBeforeSeek) {
                this.pause();
            }

            this.trigger('seeked');
        },

        playbackRate: function() {
            return this.twitchPlayer ? this.twitchPlayer.getPlaybackStats().playbackRate : 1;
        },

        duration: function() {
            return this.twitchPlayer ? this.twitchPlayer.getDuration() : 0;
        },

        currentSrc: function() {
            return this.source && this.source.src;
        },

        ended: function() {
            return this.twitchPlayer.getEnded();
        },

        volume: function() {
            return this.twitchPlayer ? this.twitchPlayer.getVolume() : 1;
        },

        setVolume: function(volume) {
            if (!this.twitchPlayer) {
                return;
            }

            this.twitchPlayer.setVolume(volume);
        },

        muted: function() {
            return this.twitchPlayer ? this.twitchPlayer.getMuted() : false;
        },

        setMuted: function(mute) {
            if (!this.twitchPlayer) {
                return;
            }

            this.twitchPlayer.setMuted(mute);

            this.setTimeout( function(){
                this.trigger('volumechange');
            }, 50);
        },

        buffered: function() {
            if(!this.twitchPlayer || !this.twitchPlayer.getVideoLoadedFraction) {
                return videojs.createTimeRange();
            }

            var bufferedEnd = this.twitchPlayer.getVideoLoadedFraction() * this.twitchPlayer.getDuration();

            return videojs.createTimeRange(0, bufferedEnd);
        },

        supportsFullScreen: function() {
            return document.fullscreenEnabled ||
                document.webkitFullscreenEnabled ||
                document.mozFullScreenEnabled ||
                document.msFullscreenEnabled;
        },
    });

    twitch.isSupported = function() {
        return true;
    };

    twitch.canPlaySource = function(e) {
        return twitch.canPlayType(e.type);
    };

    twitch.canPlayType = function(e) {
        return (e === 'video/twitch');
    };

    twitch.parseUrl = function(url) {
        var videoId = null;

        var regex = /^.*twitch\.tv\/videos\/(\d+)/;
        var match = url.match(regex);

        if (match && match.length === 2) {
            videoId = match[1];
        }

        return videoId;
    };

    function apiLoaded() {
        setTimeout(function(){
            twitch.isApiReady = true;
            for (var i = 0; i < twitch.apiReadyQueue.length; ++i) {
                twitch.apiReadyQueue[i].initTwitchPlayer();
            }
        }, 0);
    }

    function loadScript(src, callback) {
        var loaded = false;
        var tag = document.createElement('script');
        var firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        tag.onload = function () {
            if (!loaded) {
                loaded = true;
                callback();
            }
        };
        tag.onreadystatechange = function () {
            if (!loaded && (this.readyState === 'complete' || this.readyState === 'loaded')) {
                loaded = true;
                callback();
            }
        };
        tag.src = src;
    }

    function injectCss() {
        var css =
            '.vjs-twitch .vjs-iframe-blocker { display: none; }' +
            '.vjs-twitch.vjs-user-inactive .vjs-iframe-blocker { display: block; }' +
            '.vjs-twitch .vjs-poster { background-size: cover; }' +
            '.vjs-twitch-mobile .vjs-big-play-button { display: none; }';

        var head = document.head || document.getElementsByTagName('head')[0];

        var style = document.createElement('style');
        style.type = 'text/css';

        if (style.styleSheet){
            style.styleSheet.cssText = css;
        } else {
            style.appendChild(document.createTextNode(css));
        }

        head.appendChild(style);
    }

    twitch.apiReadyQueue = [];

    if (typeof document !== 'undefined'){
        loadScript('https://player.twitch.tv/js/embed/v1.js', apiLoaded);
        injectCss();
    }

    if (typeof videojs.registerTech !== 'undefined') {
        videojs.registerTech('twitch', twitch);
    } else {
        videojs.registerComponent('twitch', twitch);
    }
}));
