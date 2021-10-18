/* global XForm, XWin, Selection, Loadingbar, THREE, Generate, MouseTip, dhtmlXWindows */
/* global hash, storageAvailable, hex_rgba32, newArray2D, compress2D8, saveCanvasAsImage, getWeaveProps, patternSelection, paste1D, lookup, getRandomInt, randomBinary, loopNumber, arrayMax, compress1D, newArray2D8, limitNumber, saveAs, paste2D8, colorBrightness32, tabbyPercentage */
/* jshint esversion: 11 */
/*jshint loopfunc: true */
/*jshint -W078 */


// ----------------------------------------------------------------------------------
// On Load
// ----------------------------------------------------------------------------------
var dhxWins;

$(function() {

    "use strict";

    // -------------------------------------------------------------------------------
    // Session & Local Identification
    // ----------------------------------------------------------------------------------
    let session_hash = "no_session_hash";
    let local_hash = "no_local_hash";

    if (storageAvailable('sessionStorage')) {
        let session = window.sessionStorage;
        session_hash = session.getItem('wve_session_hash') || hash();
        session.setItem('wve_session_hash', session_hash);
    }

    if (storageAvailable('localStorage')) {
        let local = window.localStorage;
        local_hash = local.getItem('wve_local_hash') || hash();
        local.setItem('wve_local_hash', local_hash);
    }

    console.log("document.ready");

    dhxWins = new dhtmlXWindows();

    var q = {

        limits: {
            minWeaveSize: 2,
            maxWeaveSize: 16384,
            maxArtworkSize: 16384,
            maxPatternSize: 16384,
            maxRepeatSize: 16384,
            maxShafts: 256,
            maxArtworkColors: 256,
            maxTextureSize: 4096
        },

        pixelRatio: window.devicePixelRatio,

        upColor32: hex_rgba32("#005FFF"),
        downColor32: hex_rgba32("#FFFFFF"),
        upColor32_disable: hex_rgba32("#7F7F7F"),

        canvas: {},
        context: {},
        pixels: {},
        pixels8: {},
        pixels32: {},

        ctx: function(instanceId, parentDomId, id, cssW, cssH, createBuffer = false, visible = true, pixelRatio = false) {
            
            if ( !pixelRatio ) pixelRatio = q.pixelRatio;
            
            let canvas = document.getElementById(id);
            let parent = document.getElementById(parentDomId);

            let canvasW = Math.floor(cssW * pixelRatio);
            let canvasH = Math.floor(cssH * pixelRatio);

            let updateSize = false;
            let newCreation = false;

            if (!canvas) {
                canvas = document.createElement('canvas');
                canvas.id = id;
                parent.appendChild(canvas);
                q.canvas[id] = canvas;
                if (visible) {
                    parent.classList.add("graph-container");
                    canvas.classList.add("graph-canvas");
                }
                newCreation = true;

            } else {
                updateSize = cssW !== canvas.style.width || cssH !== canvas.style.height;

            }

            let context = canvas.getContext("2d");

            if (newCreation || updateSize) {
                canvas.style.width = cssW+"px";
                canvas.style.height = cssH+"px";
                canvas.width = canvasW;
                canvas.height = canvasH;
                context.scale(pixelRatio, pixelRatio);

                if (createBuffer || q.pixels[id] == undefined ) {
                    q.pixels[id] = context.createImageData(canvasW, canvasH);
                    q.pixels8[id] = q.pixels[id].data;
                    q.pixels32[id] = new Uint32Array(q.pixels8[id].buffer);
                }

            }

            q.context[id] = context;

            return context;

        },

        divs: {
            warp: ["warp-container", "warpDisplay", "warpLayerDisplay"],
            weft: ["weft-container", "weftDisplay", "weftLayerDisplay"],
            weave: ["weave-container", "weaveDisplay", "weaveLayerDisplay"],
            tieup: ["tieup-container", "tieupDisplay", "tieupLayerDisplay"],
            lifting: ["lifting-container", "liftingDisplay", "liftingLayerDisplay"],
            artwork: ["artwork-container", "artworkDisplay", "artworkLayerDisplay"],
            threading: ["threading-container", "threadingDisplay", "threadingLayerDisplay"],
            simulation: ["simulation-container", "simulationDisplay", "simulationLayerDisplay"],
            three: ["three-container", "threeDisplay"],
            model: ["model-container", "modelDisplay"],
            palette: ["palette-container"]
        },

        graphs: undefined,

        ids: function(...items) {
            return items.map(x => this.divs[x]).map(y => "#" + y).join();
        },

        jQueryObjects: function(...items) {
            return $(this.ids(...items));
        },

        graphId: function(dom_id) {
            if (this.graphs == undefined) {
                this.graphs = {};
                for (let id in q.divs) {
                    this.divs[id].forEach(function(v) {
                        q.graphs[v] = id;
                    });
                }
            }
            return this.graphs[dom_id] || false;
        }

    };

    function setToolbarTwoStateButtonGroup(view, group, target) {

        var button, state;

        var groups = {

            graphTools: {
                pointer: "toolbar-graph-tool-pointer",
                brush: "toolbar-graph-tool-brush",
                fill: "toolbar-graph-tool-fill",
                line: "toolbar-graph-tool-line",
                zoom: "toolbar-graph-tool-zoom",
                hand: "toolbar-graph-tool-hand",
                selection: "toolbar-graph-tool-selection"
            },

            artworkTools: {
                pointer: "toolbar-artwork-tool-pointer",
                brush: "toolbar-artwork-tool-brush",
                fill: "toolbar-artwork-tool-fill",
                line: "toolbar-artwork-tool-line",
                zoom: "toolbar-artwork-tool-zoom",
                hand: "toolbar-artwork-tool-hand",
                selection: "toolbar-artwork-tool-selection"
            },

            modelTools: {
                pointer: "toolbar-model-tool-pointer",
                move: "toolbar-model-tool-move",
                scale: "toolbar-model-tool-scale",
                rotate: "toolbar-model-tool-rotate"
            }

        };

        for (button in groups[group]) {
            if (groups[group].hasOwnProperty(button)) {
                state = button == target;
                app.views[view].toolbar.setItemState(groups[group][button], state);
            }
        }

    }

    function toolbarStateChange(id, state) {
        let toolbarRegex = new RegExp(/^toolbar-(.+)-tool-(pointer|brush|fill|line|zoom|hand|selection|move|scale|rotate)$/g);
        let toolbarMatch = toolbarRegex.exec(id);
        if (toolbarMatch) {
            let view = toolbarMatch[1];
            let tool = toolbarMatch[2];
            q[view].tool = tool;
        } else if (id == "toolbar-graph-grid") {
            gp.showGrid = state;
        } else if (id == "toolbar-graph-crosshair") {
            gp.crosshair = state;
        } else if (id == "toolbar-artwork-grid") {
            ap.showGrid = state;
        } else if (id == "toolbar-artwork-crosshair") {
            ap.crosshair = state;
        } else if (id == "toolbar-model-rotate") {
            mp.rotationDirection *= state ? -1 : 1;
            mp.autoRotate = state;
        }
    }

    function toolbarClick(id) {

        if (XForm.openWindowMappedToButton(id)) return;

        // console.log(id);

        // Test
        if (id == "toolbar-test-1") {
            console.log(q.three.materials);

        } else if (id == "toolbar-test-2") {
            app.myTimer.pause();
        
        } else if (id == "toolbar-test-3") {
            app.myTimer.resume();

        } else if (id == "toolbar-test-4") {
            app.myTimer.stop();
        
        } else if (id == "toolbar-test-outline") {
            console.log("outline-test");
            q.artwork.colorOutline();

            // Weave Library
        } else if (id == "toolbar-graph-weave-library") {
            XWin.show("weaves");

            // Yarn Library
        } else if (id == "toolbar-graph-yarn-library") {
            XWin.show("yarns");

        } else if (id == "toolbar-graph-create-yarn") {
            if (!XWin.isVisible("newYarn")) XWin.show("newYarn");

            // Fabric Library
        } else if (id == "toolbar-graph-project-library") {
            XWin.show("projects");

            // Edit
        } else if (id == "toolbar-graph-edit-undo") {
            app.history.undo();
        } else if (id == "toolbar-graph-edit-redo") {
            app.history.redo();

            // Edit Artwork
        } else if (id == "toolbar-artwork-edit-undo") {
            q.artwork.history.undo();
        } else if (id == "toolbar-artwork-edit-redo") {
            q.artwork.history.redo();

            // Weave Zoom
        } else if (id == "toolbar-graph-zoom-in") {
            q.graph.zoom(1);
        } else if (id == "toolbar-graph-zoom-out") {
            q.graph.zoom(-1);
        } else if (id == "toolbar-graph-zoom-reset") {
            q.graph.zoom(0);

            // Weave Lifting Mode
        } else if (id == "toolbar-graph-lifting-mode-weave") {
            switchLiftingMode("weave");
        } else if (id == "toolbar-graph-lifting-mode-liftplan") {
            switchLiftingMode("liftplan");
        } else if (id == "toolbar-graph-lifting-mode-treadling") {
            switchLiftingMode("treadling");

            // Weave Draw Style
        } else if (id == "toolbar-graph-draw-style-graph") {
            gp.drawStyle = "graph";
        } else if (id == "toolbar-graph-draw-style-color") {
            gp.drawStyle = "color";
        } else if (id == "toolbar-graph-draw-style-yarn") {
            gp.drawStyle = "yarn";

            // Toolbar Artwork
        } else if (id == "toolbar-artwork-weave-library") {
            XWin.show("weaves");

        } else if (id == "toolbar-artwork-colors") {
            XWin.show("artworkColors");

        } else if (id == "toolbar-artwork-zoom-in") {
            q.artwork.zoom(1);
        } else if (id == "toolbar-artwork-zoom-out") {
            q.artwork.zoom(-1);
        } else if (id == "toolbar-artwork-zoom-reset") {
            q.artwork.zoom(0);

            // Toolbar Simulation
        } else if (id == "toolbar-simulation-render") {
            q.simulation.render(6);

            // Toolbar Three
        } else if (id == "toolbar-three-render") {
            globalThree.buildFabric();

        } else if (id == "toolbar-three-reset-view") {
            globalThree.resetPosition();
        } else if (id == "toolbar-three-change-view") {
            q.three.changeView();

            // Toolbar Model
        } else if (id == "toolbar-model-change-view") {
            q.model.changeView();

        } else if (id == "toolbar-model-library") {
            XWin.show("models");

        } else if (id == "toolbar-model-material-library") {
            XWin.show("materials");

        } else if (id == "toolbar-model-color-material") {
            q.model.createColorMaterial();

        } else if (id == "toolbar-model-image-material") {
            q.model.createImageMaterial();

        } else if (id == "toolbar-model-weave-material") {
            q.model.createWeaveMaterial();

            // Toolbar Application
        } else if (id == "toolbar-app-about") {
            showModalWindow("About", "about-modal");
        }

    }

    // ----------------------------------------------------------------------------------
    // Layout Menu
    // ----------------------------------------------------------------------------------
    function menuClick(id) {

        // console.log(["menuClick", id]);

        var newTreadling, newThreading, newTieup, arr;

        app.contextMenu.hide();

        if (id == "view-graph") {
            app.views.show("graph");

        } else if (id == "view-artwork") {
            app.views.show("artwork");

        } else if (id == "view-simulation") {
            app.views.show("simulation");
            if (sp.mode == "quick") q.simulation.render(5);

        } else if (id == "view-three") {
            app.views.show("three");

        } else if (id == "view-model") {
            app.views.show("model");

        } else if (id == "weave-clear") {
            modify2D8("weave", "clear");

        } else if (id == "weave_scale") {
            XWin.show("scaleWeave");

        } else if (id == "weave_zoom_in") {
            q.graph.zoom(1);

        } else if (id == "weave_zoom_out") {
            q.graph.zoom(-1);

        } else if (id == "weave-tools-addwarptabby") {
            modify2D8("weave", "addwarptabby");

        } else if (id == "weave-tools-removewarptabby") {
            modify2D8("weave", "removewarptabby");

        } else if (id == "weave-tools-addwefttabby") {
            modify2D8("weave", "addwefttabby");

        } else if (id == "weave-tools-removewefttabby") {
            modify2D8("weave", "removewefttabby");

        } else if (id == "weave-tools-filltopattern") {
            var newW = q.pattern.warp.length;
            var newH = q.pattern.weft.length;
            var newWeave = arrayTileFill(q.graph.weave2D8, newW, newH);
            q.graph.set(0, "weave", newWeave);

        } else if (id == "weave-tools-remove-empty-ends") {
            let newWeave = q.graph.weave2D8.transform2D8(0, "removeemptyends");
            q.graph.set(0, "weave", newWeave);

        } else if (id == "weave-tools-remove-empty-picks") {
            let newWeave = q.graph.weave2D8.transform2D8(0, "removeemptypicks");
            q.graph.set(0, "weave", newWeave);

        } else if (id == "weave-tools-harnesscastout") {
            XWin.show("graphHarnessCastout");

        } else if (id == "weave-inverse") {
            modify2D8("weave", "inverse");

        } else if (id == "weave-reverse-horizontal") {
            modify2D8("weave", "reversex");

        } else if (id == "weave-reverse-vertical") {
            modify2D8("weave", "reversey");

        } else if (id == "weave_rotate_clockwise") {
            modify2D8("weave", "rotater");

        } else if (id == "weave_rotate_anticlockwise") {
            modify2D8("weave", "rotatel");

        } else if (id == "weave_rotate_180") {
            modify2D8("weave", "180");

        } else if (id == "weave-flipx") {
            modify2D8("weave", "flipx");

        } else if (id == "weave-flipy") {
            modify2D8("weave", "flipy");

        } else if (id == "weave_mirror_right") {
            modify2D8("weave", "mirrorr");

        } else if (id == "weave_mirror_left") {
            modify2D8("weave", "mirrorl");

        } else if (id == "weave_mirror_up") {
            modify2D8("weave", "mirroru");

        } else if (id == "weave_mirror_down") {
            modify2D8("weave", "mirrord");

        } else if (id == "weave_mirror_stitch_right") {
            modify2D8("weave", "mirror_stitch_right");

        } else if (id == "weave_mirror_stitch_left") {
            modify2D8("weave", "mirror_stitch_left");

        } else if (id == "weave_mirror_stitch_up") {
            modify2D8("weave", "mirror_stitch_up");

        } else if (id == "weave_mirror_stitch_down") {
            modify2D8("weave", "mirror_stitch_down");

        } else if (id == "weave_mirror_stitch_cross") {
            modify2D8("weave", "mirror_stitch_cross");

            // Menu Pattern
        } else if (id == "pattern-tools-filltoweave") {
            q.pattern.fillToWeave();

        } else if (id == "pattern-shuffle-warp") {
            q.pattern.shuffle("warp");

        } else if (id == "pattern-shuffle-weft") {
            q.pattern.shuffle("weft");

        } else if (id == "pattern-shuffle-fabric") {
            q.pattern.shuffle();

        } else if (id == "pattern-tile") {
            XWin.show("patternTile");

        } else if (id == "pattern_clear_warp") {
            q.pattern.clear("warp");

        } else if (id == "pattern_clear_weft") {
            q.pattern.clear("weft");

        } else if (id == "pattern_clear_warp_and_weft") {
            q.pattern.clear();

        } else if (id == "pattern_copy_warp_to_weft") {
            q.pattern.set(29, "weft", q.pattern.warp);

        } else if (id == "pattern_copy_weft_to_warp") {
            q.pattern.set(29, "warp", q.pattern.weft);

        } else if (id == "pattern_copy_swap") {
            var temp = q.pattern.warp;
            app.history.off();
            q.pattern.set(31, "warp", q.pattern.weft, false);
            q.pattern.set(32, "weft", temp);
            app.history.on();
            app.history.record("patternSwap", "warp", "weft");

        } else if (id == "pattern_flip_warp") {
            q.pattern.set(33, "warp", q.pattern.warp.reverse());

        } else if (id == "pattern_flip_weft") {
            q.pattern.set(34, "weft", q.pattern.weft.reverse());

        } else if (id == "pattern_mirror_warp") {
            let mirrored = q.pattern.warp.slice().reverse();
            q.pattern.set(35, "warp", q.pattern.warp.concat(mirrored));

        } else if (id == "pattern_mirror_weft") {
            let mirrored = q.pattern.weft.slice().reverse();
            q.pattern.set(35, "weft", q.pattern.weft.concat(mirrored));

        } else if (id == "pattern_code") {
            XWin.show("patternCode");

        } else if (id == "pattern_scale") {
            XWin.show("patternScale");

        } else if (id == "weave_tools_drop") {
            modify2D8("weave", "half_drop");

        } else if (id == "weave_tools_twill") {
            XWin.show("generateTwill");

        } else if (id == "tieup-clear") {
            arr = newArray2D(2, 2, 0);
            q.graph.set(0, "tieup", arr);

        } else if (id == "threading-clear") {
            arr = newArray2D(2, 2, 0);
            q.graph.set(0, "threading", arr);

        } else if (id == "treadling-clear") {
            arr = newArray2D(2, 2, 1);
            q.graph.set(0, "treadling", arr);

        } else if (id == "liftplan-clear") {
            arr = newArray2D(2, 2, 1);
            q.graph.set(0, "liftplan", arr);

        } else if (id == "menu_main_treadling_flip_vertical") {
            newTreadling = q.graph.lifting2D8.flip2D8("y");
            q.graph.set(0, "lifting", newTreadling);

        } else if (id == "menu_main_treadling_flip_horizontal") {
            newTreadling = q.graph.lifting2D8.flip2D8("x");
            q.graph.set(0, "lifting", newTreadling);

        } else if (id == "menu_main_threading_flip_vertical") {
            newThreading = q.graph.threading2D8.flip2D8("y");
            q.graph.set(0, "threading", newThreading);

        } else if (id == "menu_main_threading_flip_horizontal") {
            newThreading = q.graph.threading2D8.flip2D8("x");
            q.graph.set(0, "threading", newThreading);

        } else if (id == "menu_main_threading_copy_to_treadling") {
            newTreadling = q.graph.threading2D8.rotate2D8("l").flip2D8("x");
            q.graph.set(0, "lifting", newTreadling);

        } else if (id == "menu_main_treadling_copy_to_threading") {
            newThreading = q.graph.lifting2D8.rotate2D8("r").flip2D8("y");
            q.graph.set(0, "threading", newThreading);

        } else if (id == "help-debug") {
            Debug.showWindow();

            // Graph Export
        } else if (id == "weave-save-image") {
            let colors32 = new Uint32Array([q.downColor32, q.upColor32]);
            array2D8ImageSave(q.graph.weave2D8, colors32, "weave.png");

        } else if (id == "threading-save-image") {
            let colors32 = new Uint32Array([q.downColor32, q.upColor32]);
            array2D8ImageSave(q.graph.threading2D8, colors32, "threading.png");

        } else if (id == "treadling-save-image") {
            let colors32 = new Uint32Array([q.downColor32, q.upColor32]);
            array2D8ImageSave(q.graph.lifting2D8, colors32, "treadling.png");

        } else if (id == "liftplan-save-image") {
            let colors32 = new Uint32Array([q.downColor32, q.upColor32]);
            array2D8ImageSave(q.graph.lifting2D8, colors32, "liftplan.png");

        } else if (id == "tieup-save-image") {
            let colors32 = new Uint32Array([q.downColor32, q.upColor32]);
            array2D8ImageSave(q.graph.tieup2D8, colors32, "tieup.png");

            // Graph Open
        } else if (id == "weave-open-image") {
            openFileDialog("artwork", "Weave").then(file => {
                setArray2D8FromDataURL("weave", "open", file);
            });

        } else if (id == "threading-open-image") {
            openFileDialog("artwork", "Threading").then(file => {
                setArray2D8FromDataURL("threading", "open", file);
            });

        } else if (id == "treadling-open-image") {
            openFileDialog("artwork", "Treadling").then(file => {
                setArray2D8FromDataURL("treadling", "open", file);
            });

        } else if (id == "liftplan-open-image") {
            openFileDialog("artwork", "Liftplan").then(file => {
                setArray2D8FromDataURL("liftplan", "open", file);
            });

        } else if (id == "tieup-open-image") {
            openFileDialog("artwork", "Tieup").then(file => {
                setArray2D8FromDataURL("tieup", "open", file);
            });

        } else if (id == "weave-draft-image") {
            q.graph.download();

        } else if (id == "weave-library-add") {
            XWin.show("weaveLibraryAdd", q.graph.weave2D8);

        } else if (id == "weave-code") {
            XWin.show("weaveCode", compress2D8(q.graph.weave2D8));

        } else if (id == "weave-library-import") {
            openFileDialog("artwork", "Weave", true).then(file => {
                setArray2D8FromDataURL("weave", "import", file);
            });

        } else if (id == "threading-code") {
            XWin.show("threadingCode");

        } else if (id == "treadling-code") {
            XWin.show("treadlingCode");

            // Menu Project
        } else if (id == "project-new") {
            XWin.show("newProject");

        } else if (id == "project-library") {


        } else if (id == "project-open") {
            app.project.open();

        } else if (id == "project-save") {
            app.project.save();

        } else if (id == "project-library-add") {
            showProjectSaveToLibraryModal();

        } else if (id == "project-open-code") {
            XWin.show("openProjectCode");

        } else if (id == "project-open-wif") {
            app.project.openWif();

        } else if (id == "project-save-wif") {
            app.project.saveWif();

        } else if (id == "project-properties") {
            XWin.show("projectProperties");

        } else if (id == "project-print") {
            app.project.print();

            // Menu Three
        } else if (id == "three-screenshot") {
            if (globalThree.status.scene) {
                q.three.resizeRenderer(1920, 1080);
                saveCanvasAsImage(q.canvas.threeDisplay, "weave3d-screenshot.png");
                q.three.resizeRenderer(app.frame.width, app.frame.height);
            }
        } else if (id == "three-export-gltf") {
            globalThree.exportGLTF();

            // Menu Model
        } else if (id == "model-screenshot") {
            if (q.model.sceneCreated) {
                q.model.resizeRenderer(1920, 1080);
                saveCanvasAsImage(q.canvas.modelDisplay, "model3d-screenshot.png");
                q.model.resizeRenderer(app.frame.width, app.frame.height);
            }
        } else if (id == "model-import") {
            if (q.model.sceneCreated) {
                openFileDialog("gltf", "GLTF Model").then(file => {
                    q.model.importModel(file);
                });
            }

            // Menu Simulation
        } else if (id == "simulation-screenshot") {
            if (q.simulation.created) {
                saveCanvasAsImage(q.canvas.simulationDisplay, "simulation-screenshot.png");
            }
        } else if (id == "simulation-export") {
            // XWin.show("saveSimulation");
            XWin.show("exportSimulationAsImage");

            // Menu Palette
        } else if (id == "palette-default") {
            q.palette.set("default");

            // Artwork
        } else if (id == "artwork-open") {
            openFileDialog("artwork", "Artwork").then(file => {
                q.artwork.open(file);
            });

        } else if (id == "artwork-save") {
            array2D8ImageSave(q.artwork.artwork2D8, q.artwork.colors32, "wve_artwork");

        } else if (id == "artwork-clear") {
            q.artwork.clear();

        } else if (id == "artwork-resize") {
            XWin.show("resizeArtwork");

        }

    }

    $(document).on("click", ".library-list li", function(evt) {
        var li = $(this);
        li.attr("status", "selected").siblings("li").attr("status", "unselected");
        var win = li.parent().attr("data-win");
        var tab = li.parent().attr("data-tab");
        var itemId = li.attr("data-item-id");
        app.wins[win].itemSelected = {
            tab: tab,
            id: itemId
        };
    });

    $(document).on("click", ".library-list[data-win='artworkColors'] li .img-thumb", function(evt) {
        var li = $(this).parent();
        var win = li.parent().attr("data-win");
        var tab = li.parent().attr("data-tab");
        var itemId = li.attr("data-item-id");
        let weaves = app.wins.weaves;
        if (weaves.win !== undefined && !weaves.win.isHidden() && weaves.itemSelected) {
            var sId = weaves.itemSelected.id;
            var sTab = weaves.itemSelected.tab;
            q.artwork.applyWeaveToColor(itemId, sId);
        }
    });

    $(document).on("dblclick", ".library-list li", function(evt) {
        let win = $(this).parent().attr("data-win");
        let tab = $(this).parent().attr("data-tab");
        tab = typeof tab == typeof undefined || tab == "" ? false : tab;
        let itemId = $(this).attr("data-item-id");
        if (win == "weaves" && app.views.active == "graph" && (!app.wins.artworkColors.win || app.wins.artworkColors.win.isHidden())) {
            app.wins[win].itemSelected = {
                tab: tab,
                id: itemId
            };
            q.graph.set(0, "weave", q.graph.weaves[itemId].weave2D8);
        } else if (win == "models" && app.views.active == "model") {
            q.model.setModel(itemId);
        }
    });

    $(document).on("click", ".btn-library-item-action", async function(_evt) {

        let li = $(this).parents("li");
        let win = li.parent().attr("data-win");
        let btn = $(this).attr("data-action");
        let itemId = li.attr("data-item-id");

        console.log([win, btn, itemId]);

        if (win == "yarns") {

            if (btn == "edit") {
                XWin.show("editYarn", { id: itemId });

            } else if (btn == "delete") {
                let deleteYarn = await app.confirm("red", "Delete", `Are you sure you want to delete "${q.graph.yarns[itemId].name}" from the Yarn Library?`);
                if (deleteYarn) {
                    app.wins[win].removeItem(itemId);
                    XWin.show(win + ".user");
                    app.wins[win].itemSelected = false;
                }

            }

        } else if (win == "weaves") {

            if (btn == "delete") {
                let deleteWeave = await app.confirm("red", "Delete", `Are you sure you want to delete "${q.graph.weaves[itemId].title}" from the Weave Library?`);
                if (deleteWeave) {
                    app.wins[win].removeItem(itemId);
                    XWin.show(win + ".user");
                    app.wins[win].itemSelected = false;
                }

            } else if (btn == "copy") {
                var itemData = q.graph.weaves[itemId];
                Selection.content = itemData.weave2D8;
                Selection.contentType = "weave";

            }

        }

    });

    // $(document).on("click", ".btn-edit", function(evt){

    // 	var element = $(this);
    // 	var win = element.closest('ul').attr("data-win");
    // 	var tab = element.closest('ul').attr("data-tab");
    // 	var itemId = element.closest('li').attr("data-item-id");
    // 	var x = element.offset().left;
    // 	var y = element.offset().top;
    // 	var w = element.width();
    // 	var h = element.height();

    // 	if ( win == "artworkColors" ){

    // 	} else if ( win == "materials" ){
    // 		XForm.forms.modelMaterialProps.show(x, y, w, h, {
    // 			materialId: itemId
    // 		});
    // 	}

    // });

    // ----------------------------------------------------------------------------------
    // Modal Window
    // ----------------------------------------------------------------------------------
    var modalWindow;

    function showModalWindow(modalTitle, modalObject, modalWidth = 360, modalHeight = 270) {

        // app.wins.activeModalId = modalObject;

        // var parent = $("#" + modalObject);

        // var modalWindow = dhxWins.createWindow({
        //     id:"modalWindow",
        //     left:100,
        //     top:100,
        //     width:modalWidth + 16,
        //     height:modalHeight + 41,
        //     center:true,
        //     move:true,
        //     park:false,
        //     resize:false,
        //     modal: false,
        //     caption: modalTitle,
        //     header:true
        // });

        // modalWindow.stick();
        // modalWindow.bringToTop();

        // modalWindow.button("minmax").hide();
        // modalWindow.button("park").hide();
        // modalWindow.attachObject(modalObject);

        // modalWindow.button("close").attachEvent("onClick", function() {
        // 	hideModalWindow();
        // });

        // parent.find(".xclose").off("click");

        // clearModalNotifications();

        // parent.find(".xclose").click(function() {
        // 	hideModalWindow();
        // 	return false;
        // });

    }

    function hideModalWindow() {
        // $("#" + app.wins.activeModalId + " .xclose").off("click");
        // app.wins.activeModalId = false;
        // modalWindow.detachObject();
        // modalWindow.close();
    }

    function showTextAreaModal(title) {

        showModalWindow(title, "textarea-modal");
        clearModalNotifications();
        var textarea = $("#textarea-modal .xtextarea").val(compress2D8(q.graph.weave2D8));
    }

    function switchLiftingMode(mode) {

        var lastMode = q.graph.liftingMode;
        if (lastMode == mode) return;

        if (lastMode == "weave") {
            var weaveProps = getWeaveProps(q.graph.weave2D8);
            if (!weaveProps.inLimit) {
                setLiftingMode("weave");
                XWin.show("error");
                XWin.notify("error", "warning", "<strong>Switch Lifting Mode</strong></br>Weave has more than "+q.limits.maxShafts+" shafts. Switching lifting mode is not possible.");
                return;
            }
        }

        setLiftingMode(mode);

        if (lastMode == "weave") {
            q.graph.setPartsFromWeave(1);

        } else if (lastMode == "treadling" && mode == "liftplan") {
            q.graph.convertTreadlingToLiftplan();

        } else if (lastMode == "liftplan" && mode == "treadling") {
            q.graph.convertLiftplanToTieupTreadling();

        }

        app.history.record("switchLiftingMode", ...app.state.graphItems);
        q.graph.needsUpdate(177);

    }

    function setLiftingMode(mode) {
        if (!mode) return;
        q.graph.liftingMode = mode;
        app.views.graph.toolbar.setListOptionSelected("toolbar-graph-lifting-mode", "toolbar-graph-lifting-mode-" + mode);
        if (!app.views.graph.created) return;
        app.views.graph.needsUpdate = true;
        app.views.graph.update("onSetLiftingMode");
    }

    // ----------------------------------------------------------------------------------
    // Notification
    // ----------------------------------------------------------------------------------
    function notify(notifyType, notifyMsg) {
        if (!app.wins.activeModalId) {
            showModalWindow("Error", "error-modal");
        }
        var targetObj = $("#" + app.wins.activeModalId + " .xcontent");
        targetObj.append("<div class='xalert " + notifyType + "'>" + notifyMsg + "</div>");
        targetObj.scrollTop(targetObj[0].scrollHeight);
    }

    // ----------------------------------------------------------------------------------
    // Save to Library Project Modal
    // ----------------------------------------------------------------------------------
    function showProjectSaveToLibraryModal() {

        showModalWindow("Save Project to Library", "project-save-to-library-modal");

        $("#project-save-to-library-save-btn").on("click", function(e) {

            if (e.which === 1) {

                // var projectTitle = $("#project-save-to-library-name").val();
                // var projectCode = JSON.stringify(app.state.obj());

                // saveProjectToLibrary(projectCode, projectTitle);

            }

            $("#project-save-to-library-save-btn").off("click");

            return false;
        });

    }

    function clearModalNotifications() {

        $("div").remove(".xalert");

    }

    // -------------------------------------------------------------
    // Pattern Repeat Modal ----------------------------------------
    // -------------------------------------------------------------
    function showPatternRepeatModal(yarnSet, pasteIndex) {

        var tileArray = patternSelection.array;
        var canvasArray = q.pattern[yarnSet];
        var maxTiles = Math.floor(canvasArray.length / tileArray.length);

        showModalWindow("Pattern Repeat", "pattern-repeat-modal", 180, 120);
        var repeatNumInput = $("#repeatNumInput input");
        repeatNumInput.val(1);
        repeatNumInput.attr("data-max", maxTiles);

        $("#" + app.wins.activeModalId + " .action-btn").click(function(e) {

            if (e.which === 1) {

                var filledArray = arrayTileFill(tileArray, tileArray.length * repeatNumInput.val());
                var newArray = paste1D(filledArray, canvasArray, pasteIndex);
                q.pattern.set(22, yarnSet, newArray);
                hideModalWindow();
                return false;

            }

        });

    }

    // ----------------------------------------------------------------------------------
    // Disable Right Click
    // ----------------------------------------------------------------------------------
    $(document).on("contextmenu", function(e) {

        if (e.target.id == "project-open-code-textarea" || e.target.id == "project-code-save-textarea" || e.target.id == "project-properties-notes-textarea") {

        } else {
            e.preventDefault();
        }
    });

    $(".multisg,.unisg").hide();

    $("div#simulationdrawmethod select").change(function() {

        var drawMethod = $(this).val();

        //console.log(drawMethod);

        if (drawMethod == "quick") {

            $(".multisg,.unisg").hide();
            $(".quicksg").show();

        } else if (drawMethod == "unicount") {

            $(".multisg, .quicksg").hide();
            $(".unisg").show();

        } else if (drawMethod == "multicount") {

            $(".unisg,.quicksg").hide();
            $(".multisg").show();

        }

    });

    function openFileDialog(type, title, multiple = false) {

        return new Promise((resolve, reject) => {

            var info, attributes = {},
                file, valid, typeName = "";

            if (type === "artwork") {
                attributes.accept = "image/gif,image/png,image/bmp";
                valid = "image/gif|image/png|image/bmp";
                info = "png/bmp/gif";

            } else if (type === "image") {
                attributes.accept = "image/gif,image/png,image/bmp,image/jpg,image/jpeg";
                valid = "image/gif|image/png|image/bmp|image/jpg|image/jpeg";
                info = "png/bmp/gif/jpg/jpeg";

            } else if (type === "text") {
                attributes.accept = ".txt";
                valid = /text.*/;
                info = "txt";

            } else if (type === "wif") {
                attributes.accept = ".wif";
                valid = /text.*/;
                info = "wif";

            } else if (type === "wve") {
                attributes.accept = ".wve";
                valid = /text.*/;
                info = "wve";

            } else if (type === "gltf") {
                attributes.accept = ".gltf, .glb";
                valid = /text.*/;
                info = "gltf/glb";
            }

            if (multiple) attributes.multiple = "";

            $("#file-open").off("change");

            $("#file-open").on("change", function() {

                if (this.files && this.files[0]) {

                    clearModalNotifications();

                    if (multiple) {

                        for (let key in this.files) {
                            if (this.files.hasOwnProperty(key)) {
                                file = this.files[key];
                                if (file.type.match(valid) || type.in("wif", "wve")) {
                                    readFileContents(file, type).then(data => {
                                        resolve(data);
                                    });
                                } else {
                                    XWin.show("error");
                                    XWin.notify("error", "error", "<strong>Invalid " + title + " File</strong></br>File: " + file.name + "</br>" + "Valid File Type: " + info);
                                    reject();
                                }
                            }
                        }

                    } else {

                        file = this.files[0];
                        if (file.type.match(valid) || type.in("wif", "wve", "gltf")) {
                            readFileContents(file, type).then(data => {
                                resolve(data);
                            });

                        } else {
                            XWin.show("error");
                            XWin.notify("error", "error", "<strong>Invalid " + title + " File</strong></br>File: " + file.name + "</br>" + "Valid File Type: " + info);
                            reject();
                        }

                    }

                } else {
                    XWin.show("error");
                    XWin.notify("error", "error", "Error Loading File...!");
                    reject();
                }

            });

            $("#file-open").attr(attributes).val("").trigger("click");

        });

    }

    function readFileContents(file, type) {
        return new Promise((resolve, reject) => {
            let readAs = lookup(type, ["artwork", "image", "text", "wif", "wve", "gltf", "glb"], ["dataurl", "dataurl", "text", "text", "text", "arraybuffer", "arraybuffer"]);
            let reader = new FileReader();
            let output = {
                name: file.name,
                date: file.lastModified
            };
            if (readAs == "dataurl") {
                reader.onload = function() {
                    var image = new Image();
                    image.src = reader.result;
                    image.onload = function() {
                        output.image = image;
                        output.dataurl = reader.result;
                        resolve(output);
                    };
                };
                reader.readAsDataURL(file);

            } else if (readAs == "text") {
                reader.onload = function() {
                    output.text = reader.result;
                    resolve(output);
                };
                reader.readAsText(file);

            } else if (readAs == "arraybuffer") {
                var fileData = new Blob([file]);
                reader.onload = function(e) {
                    var arrayBuffer = e.target.result;
                    var bytes = new Uint8Array(arrayBuffer);
                    output.data = arrayBuffer;
                    resolve(output);
                };
                reader.readAsArrayBuffer(fileData);
            }
            reader.onerror = function() {
                XWin.show("error");
                XWin.notify("error", "error", "Unknown error!");
                reject();
            };
        });
    }

    function setSceneBackground(renderer, scene, dom, type, hex) {

        return new Promise((resolve, reject) => {

            hex = hex.replace(/^#/, '');
            let color = new THREE.Color("#" + hex);
            let rendererSize = renderer.getSize(new THREE.Vector2());

            $(dom).css({
                background: "rgb(255,255,255)"
            });

            if (type == "solid") {
                renderer.setClearColor(color, 1);
                scene.background = color;
                resolve();

            } else if (type == "transparent") {
                renderer.setClearColor(0x000000, 0);
                scene.background = null;
                $(dom).css({
                    "background-image": "url(img/transparent_check.png)"
                });
                resolve();

            } else if (type == "gradient") {

                renderer.setClearColor(0x000000, 0);
                scene.background = null;

                let ctx_w = rendererSize.x;
                let ctx_h = rendererSize.y;
                let max_wh = Math.max(ctx_w, ctx_h);
                let center_x = ctx_w / 2;
                let center_y = ctx_h / 2;
                let innerRadius = 0;
                let outerRadius = Math.pow(Math.pow(ctx_w / 2, 2) + Math.pow(ctx_h / 2, 2), 0.5);
                let radius = outerRadius;

                let ctx = q.ctx(61, "noshow", "tempCanvas", ctx_w, ctx_h, false, false);
                var gradient = ctx.createRadialGradient(center_x, center_y, innerRadius, center_x, center_y, outerRadius);
                gradient.addColorStop(0, 'white');
                gradient.addColorStop(1, "#" + hex);
                ctx.arc(center_x, center_y, radius, 0, 2 * Math.PI);
                ctx.fillStyle = gradient;
                ctx.fill();

                //bgTexture.minFilter = THREE.LinearFilter;
                let dataurl = ctx.canvas.toDataURL("image/png");
                var bgTexture = new THREE.TextureLoader().load(dataurl, function() {
                    scene.background = bgTexture;
                    resolve();
                });

            } else if (type == "image") {

                openFileDialog("image", "Background").then(file => {
                    var bgTexture = new THREE.TextureLoader().load(file.dataurl, function() {
                        //bgTexture.minFilter = THREE.LinearFilter;
                        scene.background = bgTexture;
                        resolve();
                    });
                });

            }

        });

    }

    // -------------------------------------------------------------
    // Generative Functions ----------------------------------------
    // -------------------------------------------------------------
    function generateRandomThreading(instanceId, shafts, threadingW, mirror = true, rigidity = 0, stepRigidity = false) {

        let lastShaftNum, shaftNum, threading1D, validThreading;

        // Make threading width even
        if ( isOdd(threadingW) ) threadingW++;

        // For Mirror design, half the threading plus 1
        if (mirror) threadingW = threadingW / 2 + 1;

        // If shafts are larger than threading W
        if (shafts > threadingW) shafts = threadingW;

        // If rigidity is 0 then random rigidity
        if (!rigidity) rigidity = getRandomInt(1, shafts);

        let attemptCounter = 0;
        let maxAttempts = 1000;

        do {

            attemptCounter++;
            threading1D = [];

            let rigidityCounter = 0;
            let nextInc = randomBinary() ? -1 : 1;
            shaftNum = nextInc == 1 ? 1 : shafts;
            let firstShaftNum = shaftNum;
            let sectionStartShaft = 0;

            let i = 0;
            while (i < threadingW) {

                i++;
                rigidityCounter++;
                threading1D.push(shaftNum);

                if (rigidityCounter >= rigidity) {

                    let prevInc = nextInc;
                    nextInc = randomBinary() ? -1 : 1;
                    if (prevInc == nextInc) {
                        if (stepRigidity) rigidityCounter = 0;
                    } else {
                        rigidityCounter = 1;
                    }

                }

                if (i == threadingW ) lastShaftNum = shaftNum;
                shaftNum = loopNumber(shaftNum + nextInc - 1, shafts) + 1;

            }

            let shaftsInThreading = threading1D.unique().length;
            validThreading = shaftsInThreading === shafts;

            if (validThreading && !mirror) {
                var diff = Math.abs(firstShaftNum - lastShaftNum);
                validThreading = diff == 1 || diff == shafts - 1;
            }

        } while (!validThreading && attemptCounter < maxAttempts);

        if (validThreading) {

            if (mirror) threading1D = threading1D.concat(threading1D.slice(1, -1).reverse());
            let randomThreading2D8 = threading1D_threading2D8(threading1D);
            return randomThreading2D8;
        
        } else {
            return false;

        }

    }

    function autoWeave() {

        
        var shafts = gp.autoWeaveShafts;
        var weaveW = gp.autoWeaveWidth;
        var weaveH = gp.autoWeaveHeight;
        var balanceWeave = gp.autoWeaveSquare;

        if ( balanceWeave ) weaveH = weaveW;

        var showWarpProminentSide = gp.autoWeaveShowWarpProminentSide;
        
        var minThreadingRigidity = gp.autoWeaveMinThreadingRigidity;
        var maxThreadingRigidity = gp.autoWeaveMaxThreadingRigidity;
        var threadingStepRigidity = gp.autoWeaveThreadingStepRigidity;
        
        var minTreadlingRigidity = gp.autoWeaveMinTreadlingRigidity;
        var maxTreadlingRigidity = gp.autoWeaveMaxTreadlingRigidity;
        var treadlingStepRigidity = gp.autoWeaveTreadlingStepRigidity;

        var mirrorThreading = gp.autoWeaveMirrorThreading;
        var mirrorTreadling = gp.autoWeaveMirrorTreadling;

        var maxWarpFloatReq = gp.autoWeaveMaxWarpFloat;
        var maxWeftFloatReq = gp.autoWeaveMaxWeftFloat;
        var minWarpBump = gp.autoWeaveMinWarpBump;
        var minWeftBump = gp.autoWeaveMinWeftBump;
        var minPlainArea = gp.autoWeaveMinTabby;

        var generateThreading = gp.autoWeaveGenerateThreading;
        var generateTreadling = gp.autoWeaveGenerateTreadling;
        var generateTieup = gp.autoWeaveGenerateTieup;

        var perpetualSearch = gp.autoWeavePerpetualSearch;
        var weavesFoundCounter = 0;

        var autoSave = gp.autoWeaveAutoSave;

        var maxAttempts = 1000;
        var counter = 0;

        var loadingbarTitle = perpetualSearch ? "Finding Weaves..." : "Finiding a weave...";
        var loadingbar = new Loadingbar("autoWeave", loadingbarTitle, true, true, function(){
            timer.stop();
        });

        var timer = new Timer(1, true, async function(){

            counter++;

            var upPercentage = showWarpProminentSide ? getRandomInt(50, 100) : getRandomInt(0, 100);

            var randomEnd = makeRandomEnd(shafts, "uint8", upPercentage);
            var twillDir = ["s", "z"].shuffle();
            var gen_tieup = generateTieup ? generateTwill(randomEnd, twillDir[0], 1) : q.graph.tieup2D8;

            let randomThreadingRigidity = getRandomInt(minThreadingRigidity, maxThreadingRigidity);
            var randomThreading = generateRandomThreading("generatingThreading", shafts, weaveW, mirrorThreading, randomThreadingRigidity, threadingStepRigidity);
            var gen_threading = generateThreading ? randomThreading : q.graph.threading2D8;

            var gen_treadling = q.graph.lifting2D8;
            if (generateTreadling) {
                if (balanceWeave) {
                    gen_treadling = gen_threading.rotate2D8("l").flip2D8("x");
                } else {
                    let randomTreadlingRigidity = getRandomInt(minTreadlingRigidity, maxTreadlingRigidity);
                    gen_treadling = generateRandomThreading("generatingThreading", shafts, weaveH, mirrorTreadling, randomTreadlingRigidity, treadlingStepRigidity);
                    gen_treadling = gen_treadling.rotate2D8("l").flip2D8("x");
                }
            }

            var gen_weave = getWeaveFromParts(gen_tieup, gen_threading, gen_treadling);

            var floats = Floats.count(gen_weave);
            var maxWarpFloat = Math.max(arrayMax(floats.warp.face.list), arrayMax(floats.warp.back.list));
            var maxWeftFloat = Math.max(arrayMax(floats.weft.face.list), arrayMax(floats.weft.back.list));

            if (balanceWeave) {
                maxWeftFloatReq = maxWarpFloatReq;
            }

            var validWeave = maxWarpFloat > 1 && maxWarpFloat <= maxWarpFloatReq && maxWeftFloat > 1 && maxWeftFloat <= maxWeftFloatReq;

            if (validWeave) {
                var plainAreaPercentage = tabbyPercentage(gen_weave);
                validWeave = plainAreaPercentage >= minPlainArea;
            }

            if (validWeave) {
                var weaveBump = getWeaveBump(floats.warp.face.counts, floats.weft.face.counts);
                var warpBump = weaveBump.warp;
                var weftBump = weaveBump.weft;
                validWeave = warpBump >= minWarpBump && weftBump >= minWeftBump;
            }

            if (validWeave) {

                if (q.graph.liftingMode == "weave") {
                    q.graph.set(0, "weave", gen_weave);

                } else if (q.graph.liftingMode == "liftplan") {
                    var liftplan = tieupTreadlingToLiftplan(gen_tieup, gen_treadling);
                    var tieup = newArray2D8(2, shafts, shafts);
                    for (var x = 0; x < shafts; x++) {
                        tieup[x][x] = 1;
                    }
                    q.graph.set(0, "tieup", tieup, {
                        render: false,
                        propagate: false
                    });
                    q.graph.set(0, "threading", gen_threading, {
                        render: false,
                        propagate: false
                    });
                    q.graph.set(0, "lifting", liftplan, {
                        render: false,
                        propagate: true
                    });
                    q.graph.needsUpdate(55);

                } else if (q.graph.liftingMode == "treadling") {
                    q.graph.set(0, "tieup", gen_tieup, {
                        render: false,
                        propagate: false
                    });
                    q.graph.set(0, "threading", gen_threading, {
                        render: false,
                        propagate: false
                    });
                    q.graph.set(0, "lifting", gen_treadling, {
                        render: false,
                        propagate: true
                    });
                    q.graph.needsUpdate(55);

                }

                if (app.views.active == "simulation") {
                    q.simulation.render();
                }

                // kepp seraching further
                if ( perpetualSearch ){
                    weavesFoundCounter++;
                    let weaveText = weavesFoundCounter == 1 ? " Weave" : " Weaves";
                    loadingbar.title = weavesFoundCounter + weaveText + " found";

                }

                if ( autoSave ){
                    timer.pause();
                    // var weaveDataUrl =  weave2D8_dataurl(gen_weave);
                    var microDraftDataurl = microDraft_dataurl(gen_weave, gen_threading, gen_treadling, gen_tieup);
                    var unixTimeStamp = Math.round((new Date()).getTime() / 1000).toString(16).toUpperCase();
                    var fileName = "dobby_weave_" + shafts + "_" + weaveW + "_" + weaveH + "_" + unixTimeStamp;
                    saveDataurlToServer(microDraftDataurl, fileName).then((res) => {
                        if ( res == "0" ){
                            //console.log("File save: fail!");
                        } else {
                            //console.log("File save: " + res);
                        }
                    });
                    q.simulation.renderToDataurl(function(){
                        timer.resume();
                    });
                }

                if (!perpetualSearch ) {
                    loadingbar.remove();
                    timer.stop();
                }

            }

            var progress = Math.round(counter / maxAttempts * 100);
            loadingbar.progress = progress;
            if (progress >= 100 ) counter = 0;

        });

    }

    function saveDataurlToServer(dataurl, filename){
        return new Promise((resolve, reject) => {
            $.ajax({
                type: "POST",
                url: "php/weave.server.save.php",
                data: { 
                   dataurl: dataurl,
                   filename: filename
                }
              }).done(function(res) {
                resolve(res);
              });
        });
    }


    function autoPattern() {

        var patternSize = gp.autoPatternSize;
        var isEven = gp.autoPatternEven;

        var colorLimit = gp.autoPatternColors;
        var lockColors = gp.autoPatternLockColors;
        var lockedColors = lockColors ? gp.autoPatternLockedColors.replace(/[^a-zA-Z]+/g, '').split("").shuffle() : [];
        var unlockedColors = [...
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
        ].removeArray(lockedColors).shuffle();
        var autoPatternColors = lockedColors.concat(unlockedColors).slice(0, colorLimit);

        var style = gp.autoPatternStyle;
        var styles = ["tartan", "madras", "wales", "gingham", "sequential", "golden", "gunclub", "garbage"];
        if (style == "random") style = styles.random(1)[0];

        let pattern = generatePattern(patternSize, autoPatternColors, isEven, style);
        let warpPattern = false;
        let weftPattern = false;

        var type = gp.autoPatternType;
        var types = ["balanced", "unbalanced", "warpstripes", "weftstripes"];
        if (type == "random") type = types.random(1)[0];

        if (type == "balanced") {
            warpPattern = pattern.slice();
            weftPattern = pattern.slice();
        } else if (type == "unbalanced") {
            warpPattern = pattern.slice();
            weftPattern = generatePattern(patternSize, autoPatternColors, isEven, style);
        } else if (type == "warpstripes") {
            warpPattern = pattern.slice();
            weftPattern = autoPatternColors.random(1);
        } else if (type == "weftstripes") {
            warpPattern = autoPatternColors.random(1);
            weftPattern = pattern.slice();
        } else if (type == "warponly") {
            warpPattern = pattern.slice();
        } else if (type == "weftonly") {
            weftPattern = pattern.slice();
        }

        if (warpPattern) {
            q.pattern.set(22, "warp", warpPattern, false);
        }

        if (weftPattern) {
            q.pattern.set(23, "weft", weftPattern, false);
        }

        q.pattern.needsUpdate(3);

    }

    function generatePattern(patternSize, colors, evenPattern, patternStyle) {

        if (!Array.isArray(colors)) colors.split("");
        colors.shuffle();
        var colorCount = colors.length;

        var pattern;

        if (patternStyle === "gingham") {
            pattern = Generate.ginghamPattern(patternSize, colors, evenPattern);

        } else if (patternStyle == "madras") {
            pattern = Generate.madrasPattern(patternSize, colors, evenPattern);

        } else if (patternStyle == "gunclub") {
            pattern = Generate.gunClubPattern(patternSize, colors, evenPattern);

        } else if (patternStyle == "sequential") {
            pattern = Generate.sequentialPattern(patternSize, colors, evenPattern);

        } else if (patternStyle == "wales") {
            pattern = Generate.walesPattern(patternSize, colors, evenPattern);

        } else if (patternStyle == "golden") {
            pattern = Generate.goldenRatioPattern(patternSize, colors, evenPattern);

        } else if (patternStyle == "garbage") {
            pattern = Generate.garbagePattern(patternSize, colors, evenPattern);

        } else if (patternStyle == "tartan") {
            pattern = Generate.tartanPattern(patternSize, colors, evenPattern);

        }

        return pattern;

    }

    // -------------------------------------------------------------
    // Auto Pattern Colors -----------------------------------------
    // -------------------------------------------------------------
    var autoColorPrevColors = "";

    function autoColorway() {

        let type = gp.autoColorwayType;
        var shareColors = gp.autoColorwayShareColors;
        var linkColors = gp.autoColorwayLinkColors;
        var acLockColors = gp.autoColorwayLockColors;
        var acLockedColors = gp.autoColorwayLockedColors;

        var warpPattern = q.pattern.warp;
        var weftPattern = q.pattern.weft;

        var warpColors = q.pattern.colors("warp");
        var warpColorCount = warpColors.length;
        var weftColors = q.pattern.colors("weft");
        var weftColorCount = weftColors.length;
        var fabricColors = q.pattern.colors("fabric");
        var fabricColorCount = fabricColors.length;

        var all = [...
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
        ];
        var skp = [];
        var loc = [];
        var str = [];

        if (acLockColors) {
            str = acLockedColors.split("");
        }

        str = str.removeArray(loc);
        var bal = all.removeArray(skp).removeArray(str).removeArray(loc);

        var newWarpPattern, newWeftPattern, newFabricColors;

        if (shareColors) {

            var newColors = "";
            var acCounter = 0;

            do {
                acCounter++;
                newFabricColors = loc.shuffle().concat(str.shuffle(), bal.shuffle()).slice(0, fabricColorCount).shuffle();
                newColors = newFabricColors.join("");
            } while (autoColorPrevColors == newColors && acCounter < 100);

            autoColorPrevColors = newColors;

            if (linkColors) {

                newWarpPattern = warpPattern.replaceElements(fabricColors, newFabricColors);
                newWeftPattern = weftPattern.replaceElements(fabricColors, newFabricColors);

            } else {

                newWarpPattern = warpPattern.replaceElements(warpColors, newFabricColors.shuffle());
                newWeftPattern = weftPattern.replaceElements(weftColors, newFabricColors.shuffle());

            }

        } else {

            var newWarpColors = loc.shuffle().concat(str.shuffle(), bal.shuffle()).slice(0, warpColorCount);
            newWarpPattern = warpPattern.replaceElements(warpColors, newWarpColors);

            var newWeftColors = loc.shuffle().concat(str.shuffle(), bal.shuffle()).slice(0, weftColorCount);
            newWeftPattern = weftPattern.replaceElements(weftColors, newWeftColors);

        }

        app.history.off();

        if (type.in("warpandweft", "warponly")) {
            q.pattern.set(22, "warp", newWarpPattern, false);
        }

        if (type.in("warpandweft", "weftonly")) {
            q.pattern.set(22, "weft", newWeftPattern, false);
        }

        app.history.on();

        q.pattern.needsUpdate(3);
        app.history.record("autoColor", "warp", "weft");

    }

    function makeRandomEnd(picks, format = "uint8", upPercentage = 0) {
        // console.log(arguments);
        var end, y, ups, downs;

        if (format == "uint8" && !upPercentage) {
            end = new Uint8Array(picks);
            for (y = 0; y < picks; y++) {
                end[y] = Math.random() >= 0.5 ? 1 : 0;
            }

        } else if (format == "text" && !upPercentage) {
            end = [];
            for (y = 0; y < picks; y++) {
                end[y] = Math.random() >= 0.5 ? "u" : "d";
            }
            end = compress1D(end);

        } else if (format == "uint8" && upPercentage) {
            ups = Math.round(picks * upPercentage / 100);
            downs = picks - ups;
            end = [1].repeat(ups).concat([0].repeat(downs)).shuffle();
            end = new Uint8Array(end);

        } else if (format == "text" && upPercentage) {
            ups = Math.round(picks * upPercentage / 100);
            downs = picks - ups;
            end = ["u"].repeat(ups).concat(["d"].repeat(downs)).shuffle();
            end = compress1D(end);

        }

        return end;
    }

    function generateTwill(endArray, dir, moveNum) {
        // console.log(arguments);
        var x, y, sy;
        var ts = endArray.length;
        var twillArray = newArray2D8(3, ts, ts);
        moveNum = lookup(dir, ["s", "z"], [moveNum, -moveNum]);
        for (x = 0; x < ts; x++) {
            for (y = 0; y < ts; y++) {
                sy = loopNumber(y + moveNum * x, ts);
                twillArray[x][y] = endArray[sy];
            }
        }
        return twillArray;
    }

    // -------------------------------------------------------------
    // Generate Twill Weave ----------------------------------------
    // -------------------------------------------------------------
    function updateSatinMoveNumberSelect(weaveH) {
        var moveDistance;
        var satinPossibleMoveNumbers = getPossibleSatinMoveNumbers(weaveH);
        $("#graphGenerateTwillMoveNumber").find("option").remove();
        satinPossibleMoveNumbers.forEach(function(moveNum) {
            $("#graphGenerateTwillMoveNumber").append("<option value='" + moveNum + "'>" + moveNum + "</option>");
        });
    }

    // -------------------------------------------------------------
    // Insert Ends Modal -------------------------------------------
    // -------------------------------------------------------------
    function showWeaveInsertEndsModal(endNum) {

        showModalWindow("Insert Ends", "weave-insert-ends-modal", 180, 120);

        var iweri = $("#insertWeaveEndsRightInput input");
        var iweli = $("#insertWeaveEndsLeftInput input");
        iweri.val(0);
        iweri.attr("data-max", q.limits.maxWeaveSize - q.graph.ends);
        iweli.val(0);
        iweli.attr("data-max", q.limits.maxWeaveSize - q.graph.ends);

        $("#" + app.wins.activeModalId + " .action-btn").click(function(e) {

            if (e.which === 1) {

                var iwerv = Number(iweri.val());
                var iwelv = Number(iweli.val());
                var weaveArray = q.graph.weave2D8;
                var emptyRightEndArray = newArray2D8(5, iwerv, q.graph.picks);
                var emptyLeftEndArray = newArray2D8(5, iwelv, q.graph.picks);
                weaveArray = weaveArray.insertArrayAt(endNum, emptyRightEndArray);
                weaveArray = weaveArray.insertArrayAt(endNum - 1, emptyLeftEndArray);
                q.graph.set(3, weaveArray);
                // weaveHighlight.clear();
                hideModalWindow();
                return false;

            }

        });

    }

    $("#insertWeaveEndsRightInput").spinner("changed", function(e, newVal, oldVal) {
        $("#insertWeaveEndsLeftInput input").attr("data-max", q.limits.maxWeaveSize - q.graph.ends - newVal);
    });

    $("#insertWeaveEndsLeftInput").spinner("changed", function(e, newVal, oldVal) {
        $("#insertWeaveEndsRightInput input").attr("data-max", q.limits.maxWeaveSize - q.graph.ends - newVal);
    });

    // -------------------------------------------------------------
    // Insert Picks Modal -------------------------------------------
    // -------------------------------------------------------------
    function showWeaveInsertPicksModal(pickNum) {

        var x;
        showModalWindow("Insert Pickss", "weave-insert-picks-modal", 180, 120);

        var iwpai = $("#insertWeavePicksAboveInput input");
        var iwpbi = $("#insertWeavePicksBelowInput input");
        iwpai.val(0);
        iwpai.attr("data-max", q.limits.maxWeaveSize - q.graph.picks);
        iwpbi.val(0);
        iwpbi.attr("data-max", q.limits.maxWeaveSize - q.graph.picks);

        $("#" + app.wins.activeModalId + " .action-btn").click(function(e) {

            if (e.which === 1) {

                var iwpav = Number(iwpai.val());
                var iwpbv = Number(iwpbi.val());
                var weaveArray = q.graph.weave2D8;
                var emptyAbovePickArray = [1].repeat(iwpav);
                var emptyBelowPickArray = [1].repeat(iwpbv);

                for (x = 0; x < q.graph.ends; x++) {
                    weaveArray[x] = weaveArray[x].insertArrayAt(pickNum, emptyAbovePickArray);
                }

                for (x = 0; x < q.graph.ends; x++) {
                    weaveArray[x] = weaveArray[x].insertArrayAt(pickNum - 1, emptyBelowPickArray);
                }

                q.graph.set(4, weaveArray);
                // weaveHighlight.clear();
                hideModalWindow();
                return false;

            }

        });

    }

    $("#insertWeavePicksAboveInput").spinner("changed", function(e, newVal, oldVal) {
        $("#insertWeavePicksBelowInput input").attr("data-max", q.limits.maxWeaveSize - q.graph.picks - newVal);
    });

    $("#insertWeavePicksBelowInput").spinner("changed", function(e, newVal, oldVal) {
        $("#insertWeavePicksAboveInput input").attr("data-max", q.limits.maxWeaveSize - q.graph.picks - newVal);
    });

    // -------------------------------------------------------------
    // Weave Manipulation ------------------------------------------
    // -------------------------------------------------------------
    function modify2D8(graph, command, val = 0, val2 = 0) {

        var res;
        var validPaste = true;

        if (Selection.graph == graph && Selection.isCompleted) {

            var array2D8 = app.selection.selected;
            var modifiedArray2D8 = array2D8.transform2D8(0, command, val, val2);
            if (modifiedArray2D8.length == array2D8.length && modifiedArray2D8[0].length == array2D8[0].length) {
                var canvas2D8 = q.graph.get(graph);
                var seamlessX = lookup(graph, ["weave", "threading"], [gp.seamlessWeave, gp.seamlessThreading]);
                var seamlessY = lookup(graph, ["weave", "lifting"], [gp.seamlessWeave, gp.seamlessLifting]);
                var xOverflow = seamlessX ? "loop" : "extend";
                var yOverflow = seamlessY ? "loop" : "extend";
                res = paste2D8(modifiedArray2D8, canvas2D8, Selection.minX, Selection.minY, xOverflow, yOverflow, 0);
            } else {
                validPaste = false;
            }

        } else {

            if (q.graph[graph + "2D8"].is2D8()) {
                res = q.graph[graph + "2D8"].transform2D8(0, command, val, val2);
            } else {
                validPaste = false;
            }

        }

        if (validPaste) {
            q.graph.set(12, graph, res);
        }

    }

    function dataURLToImageData(dataurl) {
        console.log("dataURLToImageData");
        var w = dataurl.width;
        var h = dataurl.height;
        var x = q.ctx(61, "noshow", "dataurl-to-imgdata", w, h, false, false);
        //x.clearRect(0, 0, w, h)
        x.fillStyle = "#FFFFFF";
        x.fillRect(0, 0, w, h);
        x.drawImage(dataurl, 0, 0);
        return x.getImageData(0, 0, w, h);
    }

    function weaveComponentsToMicroDraftImage(threading, treadling, tieup, weave){
        let threadingW = threading.length;
        let threadingH = threading[0].length;
        let treadlingW = treadling.length;
        let treadlingH = treadling[0].length;
        let tieupW = tieup.length;
        let tieupH = tieup[0].length;
        let weaveW = weave.length;
        let weaveH = weave[0].length;
    }

    function array2D8ImageSave(arr2D8, colors32, defaultFileName = "image") {

        Debug.time("array2D8ImageSave");

        var loadingbar = new Loadingbar("weaveImageSave", "Saving Weave", true);

        var iw = arr2D8.length;
        var ih = arr2D8[0].length;

        var i, x, y;
        let ctx = q.ctx(61, "noshow", "arr-to-image", iw, ih);
        var imagedata = ctx.createImageData(iw, ih);
        var pixels = new Uint32Array(imagedata.data.buffer);

        var chunkSize = 1024;
        var xChunks = Math.ceil(iw / chunkSize);
        var yChunks = Math.ceil(ih / chunkSize);
        var totalChunks = xChunks * yChunks;
        var percentagePerChunk = 100 / totalChunks;

        var startX = 0;
        var startY = 0;
        var endX = xChunks == 1 ? iw : chunkSize;
        var endY = yChunks == 1 ? ih : chunkSize;

        var cycle = 0;

        $.doTimeout("weaveImageSave", 10, function() {

            Debug.time("saveCycleTime");

            for (y = startY; y < endY; y++) {
                i = (ih - y - 1) * iw;
                for (x = startX; x < endX; x++) {
                    pixels[i + x] = colors32[arr2D8[x][y]];
                }
            }
            cycle++;

            loadingbar.progress = Math.round(cycle * percentagePerChunk);

            if (endY >= ih && endX >= iw) {
                Debug.timeEnd("array2D8ImageSave");
                loadingbar.remove();
                ctx.putImageData(imagedata, 0, 0);
                ctx.canvas.toBlob(function(blob) {
                    saveAs(blob, defaultFileName);
                });
                return false;
            }

            if (endX >= iw) {
                startY = y;
                endY = limitNumber(startY + chunkSize, 0, ih);
                startX = 0;
                endX = limitNumber(startX + chunkSize, 0, iw);
            } else {
                startX = x;
                endX = limitNumber(startX + chunkSize, 0, iw);
            }

            Debug.timeEnd("saveCycleTime");
            return true;

        });

    }

    function setArray2D8FromDataURL(target, action, file) {

        let thread_id = "setArrFromDataURL" + file.name;
        Debug.time(thread_id);

        let loadingbar = new Loadingbar(thread_id, "Reading", true, false);

        let success = true;

        let iw = file.image.width;
        let ih = file.image.height;

        let maxS = q.limits.maxShafts;
        let maxV = q.limits.maxWeaveSize;
        let maxA = q.limits.maxArtworkSize;

        let maxW = lookup(target, ["weave", "tieup", "threading", "treadling", "liftplan", "artwork"], [maxV, maxS, maxV, maxS, maxS, maxA]);
        let maxH = lookup(target, ["weave", "tieup", "threading", "treadling", "liftplan", "artwork"], [maxV, maxS, maxS, maxV, maxV, maxA]);

        if ( iw <= maxW && ih <= maxH ) {

            var i, x, y;
            var idata = dataURLToImageData(file.image);
            var buffer = new Uint32Array(idata.data.buffer);

            var chunkSize = target == "artwork" ? 512 : 1024;
            var xChunks = Math.ceil(iw / chunkSize);
            var yChunks = Math.ceil(ih / chunkSize);
            var totalChunks = xChunks * yChunks;
            var percentagePerChunk = 100 / totalChunks;

            var startX = 0;
            var startY = 0;
            var endX = xChunks == 1 ? iw : chunkSize;
            var endY = yChunks == 1 ? ih : chunkSize;

            var cycle = 0;

            var array2D8 = newArray2D8(7, iw, ih);

            if (target.in("weave", "tieup", "threading", "treadling", "liftplan")) {

                loadingbar.title = "Importing";

                var color0 = buffer[0];
                var color0State = colorBrightness32(color0) < 128 ? 1 : 0;

                $.doTimeout(thread_id, 10, function() {

                    Debug.time("cycleTime");

                    for (y = startY; y < endY; y++) {
                        i = (ih - y - 1) * iw;
                        for (x = startX; x < endX; x++) {
                            array2D8[x][y] = colorBrightness32(buffer[i + x]) < 128 ? 1 : 0;
                        }
                    }
                    cycle++;

                    loadingbar.progress = Math.round(cycle * percentagePerChunk);

                    if (endY >= ih && endX >= iw) {
                        Debug.timeEnd(thread_id);
                        loadingbar.remove();

                        if (action == "open") {
                            q.graph.set(0, target, array2D8);
                        } else if (action === "import") {
                            app.wins.weaves.addItem("user", file.name + "-" + target, array2D8);
                            XWin.show("weaves.user");
                        }
                        return false;
                    }

                    if (endX >= iw) {
                        startY = y;
                        endY = limitNumber(startY + chunkSize, 0, ih);
                        startX = 0;
                        endX = limitNumber(startX + chunkSize, 0, iw);
                    } else {
                        startX = x;
                        endX = limitNumber(startX + chunkSize, 0, iw);
                    }

                    Debug.timeEnd("cycleTime");
                    return true;

                });

            } else if (target == "artwork") {

                loadingbar.title = "Reading Artwork Image";

                var c, ix, colors = [];
                let colorLimit = q.limits.maxArtworkColors;

                $.doTimeout(thread_id, 10, function() {

                    Debug.time("cycleTime");

                    for (y = startY; y < endY; y++) {
                        i = (ih - y - 1) * iw;
                        for (x = startX; x < endX; x++) {
                            c = buffer[i + x];
                            ix = colors.indexOf(c);
                            if (ix == -1) {
                                ix = colors.length;
                                if (ix >= colorLimit) {
                                    success = false;
                                    break;
                                }
                                colors[ix] = c;
                            }
                            array2D8[x][y] = ix;
                        }
                        if (!success) break;
                    }

                    if (!success) {
                        loadingbar.remove();
                        XWin.show("error");
                        XWin.notify("error", "error", "<strong>Image Colors Exceeing Limit</strong></br>" + "Maximum Colors Limit: " + q.limits.maxArtworkColors);
                        return false;
                    }

                    cycle++;

                    loadingbar.progress = Math.round(cycle * percentagePerChunk);

                    if (endY >= ih && endX >= iw) {
                        q.artwork.set(array2D8, colors);
                        Debug.timeEnd(thread_id);
                        loadingbar.remove();
                        return false;
                    }

                    if (endX >= iw) {
                        startY = y;
                        endY = limitNumber(startY + chunkSize, 0, ih);
                        startX = 0;
                        endX = limitNumber(startX + chunkSize, 0, iw);
                    } else {
                        startX = x;
                        endX = limitNumber(startX + chunkSize, 0, iw);
                    }

                    Debug.timeEnd("cycleTime");
                    return true;

                });

            }

        } else {

            loadingbar.remove();
            XWin.show("error");
            XWin.notify("error", "error", "<strong>Image Size Exceeing Limit</strong></br>" + "Image Dimensions: " + iw + " &times; " + ih + "</br>Limit: " + maxW + " &times; " + maxH);

        }

    }

    function setArray2D8FromDataURL_promise(target, action, file) {

        let thread_id = "setArrFromDataURL" + file.name;
        Debug.time(thread_id);

        let loadingbar = new Loadingbar(thread_id, "Reading", true, false);

        let success = true;

        let iw = file.image.width;
        let ih = file.image.height;

        let maxS = q.limits.maxShafts;
        let maxV = q.limits.maxWeaveSize;
        let maxA = q.limits.maxArtworkSize;

        let maxW = lookup(target, ["weave", "tieup", "threading", "treadling", "liftplan", "artwork"], [maxV, maxS, maxV, maxS, maxS, maxA]);
        let maxH = lookup(target, ["weave", "tieup", "threading", "treadling", "liftplan", "artwork"], [maxV, maxS, maxS, maxV, maxV, maxA]);

        if ( iw <= maxW && ih <= maxH ) {

            var i, x, y;
            var idata = dataURLToImageData(file.image);
            var buffer = new Uint32Array(idata.data.buffer);

            var chunkSize = target == "artwork" ? 512 : 1024;
            var xChunks = Math.ceil(iw / chunkSize);
            var yChunks = Math.ceil(ih / chunkSize);
            var totalChunks = xChunks * yChunks;
            var percentagePerChunk = 100 / totalChunks;

            var startX = 0;
            var startY = 0;
            var endX = xChunks == 1 ? iw : chunkSize;
            var endY = yChunks == 1 ? ih : chunkSize;

            var cycle = 0;

            var array2D8 = newArray2D8(7, iw, ih);

            if (target.in("weave", "tieup", "threading", "treadling", "liftplan")) {

                loadingbar.title = "Importing";

                var color0 = buffer[0];
                var color0State = colorBrightness32(color0) < 128 ? 1 : 0;

                $.doTimeout(thread_id, 10, function() {

                    Debug.time("cycleTime");

                    for (y = startY; y < endY; y++) {
                        i = (ih - y - 1) * iw;
                        for (x = startX; x < endX; x++) {
                            array2D8[x][y] = colorBrightness32(buffer[i + x]) < 128 ? 1 : 0;
                        }
                    }
                    cycle++;

                    loadingbar.progress = Math.round(cycle * percentagePerChunk);

                    if (endY >= ih && endX >= iw) {
                        Debug.timeEnd(thread_id);
                        loadingbar.remove();

                        if (action == "open") {
                            q.graph.set(0, target, array2D8);
                        } else if (action === "import") {
                            app.wins.weaves.addItem("user", file.name + "-" + target, array2D8);
                            XWin.show("weaves.user");
                        }
                        return false;
                    }

                    if (endX >= iw) {
                        startY = y;
                        endY = limitNumber(startY + chunkSize, 0, ih);
                        startX = 0;
                        endX = limitNumber(startX + chunkSize, 0, iw);
                    } else {
                        startX = x;
                        endX = limitNumber(startX + chunkSize, 0, iw);
                    }

                    Debug.timeEnd("cycleTime");
                    return true;

                });

            } else if (target == "artwork") {

                loadingbar.title = "Reading Artwork Image";

                var c, ix, colors = [];
                let colorLimit = q.limits.maxArtworkColors;

                $.doTimeout(thread_id, 10, function() {

                    Debug.time("cycleTime");

                    for (y = startY; y < endY; y++) {
                        i = (ih - y - 1) * iw;
                        for (x = startX; x < endX; x++) {
                            c = buffer[i + x];
                            ix = colors.indexOf(c);
                            if (ix == -1) {
                                ix = colors.length;
                                if (ix >= colorLimit) {
                                    success = false;
                                    break;
                                }
                                colors[ix] = c;
                            }
                            array2D8[x][y] = ix;
                        }
                        if (!success) break;
                    }

                    if (!success) {
                        loadingbar.remove();
                        XWin.show("error");
                        XWin.notify("error", "error", "<strong>Image Colors Exceeing Limit</strong></br>" + "Maximum Colors Limit: " + q.limits.maxArtworkColors);
                        return false;
                    }

                    cycle++;

                    loadingbar.progress = Math.round(cycle * percentagePerChunk);

                    if (endY >= ih && endX >= iw) {
                        q.artwork.set(array2D8, colors);
                        Debug.timeEnd(thread_id);
                        loadingbar.remove();
                        return false;
                    }

                    if (endX >= iw) {
                        startY = y;
                        endY = limitNumber(startY + chunkSize, 0, ih);
                        startX = 0;
                        endX = limitNumber(startX + chunkSize, 0, iw);
                    } else {
                        startX = x;
                        endX = limitNumber(startX + chunkSize, 0, iw);
                    }

                    Debug.timeEnd("cycleTime");
                    return true;

                });

            }

        } else {

            loadingbar.remove();
            XWin.show("error");
            XWin.notify("error", "error", "<strong>Image Size Exceeing Limit</strong></br>" + "Image Dimensions: " + iw + " &times; " + ih + "</br>Limit: " + maxW + " &times; " + maxH);

        }

    }

    function trimWeave2D8(instanceId, weave, sides = "", minEnds = 0, minPicks = 0) {

        // logTime("trimWeave2D8");

        // console.log(["trimWeave2D8", instanceId, sides, weave]);

        var x, y;

        sides = sides.split("");
        var ends = weave.length;
        var picks = 0;
        for (x = 0; x < ends; x++) {
            picks = Math.max(picks, weave[x].length);
        }

        var newPicks = picks;

        // Remove empty ends from right;
        if (sides.includes("r")) {
            x = ends - 1;
            while (x > 1 && weave[x].allEqual(0)) {
                weave.length = x;
                x -= 1;
            }
        }

        // Remove empty ends from top;
        var deleteThis = true;
        if (sides.includes("t")) {
            for (y = picks - 1; y > 1; --y) {
                for (x = 0; x < weave.length; x++) {
                    if (weave[x][y]) {
                        deleteThis = false;
                    }
                }
                if (deleteThis) {
                    newPicks = y;
                } else {
                    break;
                }
            }
            if (newPicks !== picks) {
                for (x = 0; x < weave.length; x++) {
                    weave[x] = weave[x].subarray(0, newPicks);
                }
            }
        }

        //logTimeEnd("trimWeave2D8");

        return weave;
    }

    // --------------------------------------------------
    // Graph Mouse Interaxtions -------------------------
    // --------------------------------------------------
    var graphElements = q.jQueryObjects("weave", "warp", "weft", "threading", "lifting", "tieup");
    var wheelElements = q.jQueryObjects("weave", "warp", "weft", "threading", "lifting", "tieup", "artwork");
    var mouseElements = q.jQueryObjects("weave", "warp", "weft", "threading", "lifting", "tieup", "artwork", "simulation", "three", "model");

    mouseElements.on("mouseenter", function(evt) {
        MouseTip.show();
        var graph = q.graphId($(this).attr("id"));
        Selection.onMouseEnter(graph);
        if (graph && graph.in("warp", "weft")) graph = "pattern";
        graphElements.css({
            "box-shadow": "0px 0px 0px " + app.ui.shadow + "px " + app.ui.shadowHex,
            "-webkit-box-shadow": "0px 0px 0px " + app.ui.shadow + "px " + app.ui.shadowHex,
            "-moz-box-shadow": "0px 0px 0px " + app.ui.shadow + "px " + app.ui.shadowHex
        });
        if (graph && !graph.in("artwork", "simulation")) {
            $(this).css({
                "box-shadow": "0px 0px 0px " + app.ui.shadow + "px " + app.ui.focusShadowHex,
                "-webkit-box-shadow": "0px 0px 0px " + app.ui.shadow + "px " + app.ui.focusShadowHex,
                "-moz-box-shadow": "0px 0px 0px " + app.ui.shadow + "px " + app.ui.focusShadowHex
            });
        }
    });

    mouseElements.on("mouseout", function(evt) {
        let graph = q.graphId($(this).attr("id"));
        MouseTip.hide();
        Selection.onMouseOut(graph);
        $(".palette-chip").removeClass('palette-chip-hover');
    });

    wheelElements.on('mousewheel', function(e) {

        var graph = q.graphId($(this).attr("id"));

        let dx = Number(e.deltaX);
        let dy = Number(e.deltaY);

        let gx = q.graph.scroll.x - dx;
        let gy = q.graph.scroll.y - dy;

        let tx = q.tieup.scroll.x - dx;
        let ty = q.tieup.scroll.y - dy;

        if (graph.in("threading", "warp")) {
            q.graph.scroll.setPos({
                x: gx
            });
            if (graph == "threading") q.tieup.scroll.setPos({
                y: ty
            });

        } else if (graph.in("lifting", "weft")) {
            q.graph.scroll.setPos({
                y: gy
            });
            if (graph == "lifting") q.tieup.scroll.setPos({
                x: tx
            });

        } else if (graph == "weave") {
            q.graph.scroll.setPos({
                x: gx,
                y: gy
            });

        } else if (graph == "tieup") {
            q.tieup.scroll.setPos({
                x: tx,
                y: ty
            });

        } else if (graph == "artwork") {
            q.artwork.scroll.setPos({
                x: q.artwork.scroll.x - dx,
                y: q.artwork.scroll.y - dy
            });

        } else if (graph == "simulation") {
            q.simulation.scroll.setPos({
                x: q.simulation.scroll.x - dx,
                y: q.simulation.scroll.y - dy
            });

        }

        var mouse = getGraphMouse(graph, app.mouse.x, app.mouse.y);

        if (mouse) {
            if (graph.in("warp", "weft")) {
                var pos = graph == "warp" ? mouse.col : mouse.row;
                MouseTip.text(0, pos);

            } else if (graph == "artwork") {
                MouseTip.text(0, mouse.col + ", " + mouse.row);
                var pci = q.artwork.pointColorIndex(mouse);
                if (isSet(pci)) {
                    MouseTip.text(1, pci);
                } else {
                    MouseTip.remove(1);
                }
            }
        }

        Selection.onMouseMove(graph, mouse.col - 1, mouse.row - 1);
        Selection.crosshair(graph, mouse.col - 1, mouse.row - 1);

        // Disable Pinch-Zoom on Graphs
        event.preventDefault();

    });

    // document.mousedown
    $(document).on("mousedown", q.ids("warp", "weft"), function(e) {

        e.stopPropagation();

        var seamless, pasteMethod;

        let clientx = e.clientX;
        let clienty = e.clientY;

        let yarnSet = q.graphId($(this).attr("id"));
        let mouse = getGraphMouse(yarnSet, clientx, clienty);

        let isWarp = yarnSet == "warp";
        var otherYarnSet = isWarp ? "weft" : "warp";

        var threadNum = isWarp ? mouse.end : mouse.pick;
        var posNum = isWarp ? mouse.col : mouse.row;

        if (e.which == undefined) {

        } else if (e.which == 1) {

            var code = q.palette.selected;
            app.mouse.graph = yarnSet;
            if (isWarp) {
                app.mouse.col = mouse.col;
                app.mouse.end = mouse.end;
                seamless = gp.seamlessWarp;

            } else {
                app.mouse.row = mouse.row;
                app.mouse.pick = mouse.pick;
                seamless = gp.seamlessWeft;
            }
            app.patternCopy = {
                activeSet: yarnSet,
                otherSet: otherYarnSet,
                warp: q.pattern.warp.slice(0),
                weft: q.pattern.weft.slice(0),
                active: q.pattern[yarnSet].slice(0),
                other: q.pattern[otherYarnSet].slice(0)
            };

            if (q.graph.tool == "selection") {
                if (!Selection.inProgress) Selection.setActive(yarnSet);
                var selectionMouse = getGraphMouse(Selection.graph, clientx, clienty);
                Selection.onMouseDown(Selection.graph, selectionMouse.col - 1, selectionMouse.row - 1);

            } else if (q.graph.tool == "fill") {
                app.history.off();
                q.pattern.fillStripe(yarnSet, threadNum, code);
                if (gp.lockWarpToWeft) q.pattern.set(44, otherYarnSet, q.pattern[yarnSet], true, false);
                app.action = "patternFill";
                app.history.on();

            } else if (q.graph.tool == "pointer" || q.graph.tool == "brush") {
                app.history.off();
                app.patternPaint = true;
                app.patternPaintStartNum = isWarp ? mouse.col : mouse.row;
                if (seamless) {
                    pasteMethod = "loop";
                } else {
                    pasteMethod = code === "0" ? "trim" : "extend";
                }
                q.pattern.set(44, yarnSet, code, true, threadNum, pasteMethod);
                if (gp.lockWarpToWeft) q.pattern.set(44, otherYarnSet, q.pattern[yarnSet], true, false);
                app.history.on();

            }

        } else if (e.which == 2) {

        } else if (e.which == 3) {
            q.pattern.rightClick.yarnSet = yarnSet;
            q.pattern.rightClick.threadNum = posNum;
            q.pattern.rightClick.code = q.pattern[yarnSet][posNum - 1];
            app.contextMenu.pattern.obj.showContextMenu(clientx, clienty);

        }

    });

    // -------------------------------------------------------------
    // Fill Array with Tile Array ----------------------------------
    // -------------------------------------------------------------
    function arrayTileFill(tile, canvasW, canvasH = false) {

        var x, y, res;
        var tileW = tile !== undefined ? tile.length : 0;

        // if 2D Array
        if (canvasH) {

            res = tile[0] !== undefined && tile[0] instanceof Uint8Array ? newArray2D8(14, canvasW, canvasH) : newArray2D(canvasW, canvasH);
            var tileH = tile[0] !== undefined ? tile[0].length : 0;
            for (x = 0; x < canvasW; x++) {
                for (y = 0; y < canvasH; y++) {
                    res[x][y] = tile[x % tileW][y % tileH];
                }
            }

            // if 1D Array
        } else {

            res = tile !== undefined && tile instanceof Uint8Array ? new Uint8Array(canvasW) : [];
            for (x = 0; x < canvasW; x++) {
                res.push(tile[x % tileW]);
            }

        }
        return res;
    }

    function setContainerSizePosition(id, w, h, b, l) {
        $("#" + id).css({
            "width": w,
            "height": h,
            "bottom": b,
            "left": l,
            "box-shadow": "0px 0px 0px " + app.ui.shadow + "px " + app.ui.shadowHex,
            "-webkit-box-shadow": "0px 0px 0px " + app.ui.shadow + "px " + app.ui.shadowHex,
            "-moz-box-shadow": "0px 0px 0px " + app.ui.shadow + "px " + app.ui.shadowHex
        });
    }

    $(document).on("mousedown", "#graph-resizer-button", function(evt) {
        app.mouse.isDown = true;
        if (evt.which == 1) {
            app.mouse.down.target = "graph-resizer-button";
            app.mouse.down.x = app.mouse.x;
            app.mouse.down.y = app.mouse.y;
            app.mouse.down.time = getTimeStamp();
            app.tieupResizeStart = true;
            app.tieupResizeStartW = gp.tieupBoxW;
            app.tieupResizeStartH = gp.tieupBoxH;
            setCursor("nesw-resize");
        }
    });

    // --------------------------------------------------
    // g_weave Array Functions ---------------------
    // --------------------------------------------------
    function checkErrors(objType, obj) {

        var errors = [];

        if (objType == "weave") {

            var weaveWidth = obj.length;
            if (weaveWidth > q.limits.maxWeaveSize) errors.push("Can't insert end. Maximum limit of weave size is " + q.limits.maxWeaveSize + " Ends.");
            if (weaveWidth < q.limits.minWeaveSize) errors.push("Can't delete end. Minimum limit of weave size reached.");

            if (obj[0] !== undefined) {
                var weaveHeight = obj[0].length;
                if (weaveHeight > q.limits.maxWeaveSize) errors.push("Can't insert pick. Maximum limit of weave size is " + q.limits.maxWeaveSize + " Picks.");
                if (weaveHeight < q.limits.minWeaveSize) errors.push("Can't delete pick. Minimum limit of weave size reached.");
            }

        } else if (objType == "project") {

            errors.push("Invalid File Type!");

        } else if (objType == "pattern") {

            var patternSize = obj.length;
            if (patternSize > q.limits.maxPatternSize) errors.push("Maximum limit of pattern size is " + q.limits.maxPatternSize + " threads.");

        } else if (objType == "simulation") {

            var weaveArray = q.graph.weave2D8;
            var warpPatternArray = q.pattern.warp;
            var weftPatternArray = q.pattern.weft;
            var warpPatternSize = warpPatternArray.length;
            var weftPatternSize = weftPatternArray.length;
            var weaveEnds = weaveArray.length;
            var weavePicks = weaveArray[0].length;
            var warpRepeatSize = [weaveEnds, warpPatternSize].lcm();
            var weftRepeatSize = [weavePicks, weftPatternSize].lcm();
            if (warpRepeatSize > q.limits.maxRepeatSize) errors.push("Warp Color Weave Repeat Exceeding Limit of " + q.limits.maxRepeatSize + " Ends.");
            if (weftRepeatSize > q.limits.maxRepeatSize) errors.push("Weft Color Weave Repeat Exceeding Limit of " + q.limits.maxRepeatSize + " Picks.");
            if (warpPatternArray.indexOf("BL") !== -1) errors.push("Warp Pattern contains empty threads.");
            if (weftPatternArray.indexOf("BL") !== -1) errors.push("Weft Pattern contains empty threads.");
            if (warpPatternSize === 0) errors.push("Warp Pattern is empty.");
            if (weftPatternSize === 0) errors.push("Weft Pattern is empty.");

        }

        return errors;

    }

    // ----------------------------------------------------------------------------------
    // Remove Javascript Code ID
    // ----------------------------------------------------------------------------------
    $("#sid").remove();

    // ----------------------------------------------------------------------------------
    // Javascript URL Binding
    // ----------------------------------------------------------------------------------
    var jsurl = $(location).attr("hostname");
    var jsdomain = jsurl.replace("www.", "");

    /*if (jsdomain !== "wve.app" && jsdomain !== "localhost") {
    	alert(jsdomain + " : Redirecting to " + "http://www.wve.app/dist");
    	$(window).unbind("beforeunload");
    	window.location.href = "http://www.wve.app/dist";
    	throw new Error("Error");
    }*/

    function liftplanToTieupTreadling(liftplan2D8, origin = "bl") {

        var trimSides = lookup(origin, ["bl", "br", "tr", "tl"], ["tr", "tl", "bl", "br"]);
        liftplan2D8 = trimWeave2D8(5, liftplan2D8, trimSides);

        var liftplan = liftplan2D8.rotate2D8("r").flip2D8("y");
        var tt = unique2D(liftplan);
        var tieup2D8 = trimWeave2D8(7, tt.uniques, trimSides);
        var posArray = tt.posIndex;
        var treadling2D8 = newArray2D(liftplan2D8.length, liftplan2D8[0].length, 0);
        posArray.forEach(function(v, i) {
            treadling2D8[v][i] = 1;
        });

        treadling2D8 = trimWeave2D8(6, treadling2D8, trimSides);
        return [tieup2D8, treadling2D8];
    }

    function tieupTreadlingToLiftplan(tieup2D8, treadling2D8, origin = "bl") {

        var trimSides = lookup(origin, ["bl", "br", "tr", "tl"], ["tr", "tl", "bl", "br"]);

        tieup2D8 = trimWeave2D8(3, tieup2D8, trimSides);
        treadling2D8 = trimWeave2D8(4, treadling2D8, trimSides);

        var treadlingW = treadling2D8.length;
        var treadlingH = treadling2D8[0].length;
        var treadles = tieup2D8.length;
        var shafts = tieup2D8[0].length;
        var liftplanPick;

        var liftplanW = Math.min(treadlingW, treadles);
        var liftplan2D8_RRFY = newArray2D8(16, treadlingH, liftplanW);

        for (var y = 0; y < treadlingH; y++) {
            liftplanPick = new Uint8Array(shafts);
            for (var x = 0; x < liftplanW; x++) {
                if (treadling2D8[x][y]) {
                    liftplanPick = arrayBinary("OR", liftplanPick, tieup2D8[x]);
                }
            }
            liftplan2D8_RRFY[y] = liftplanPick;
        }

        var result = liftplan2D8_RRFY.rotate2D8("l").flip2D8("x");
        result = trimWeave2D8(5, result, trimSides);

        return result;
    }

    // ----------------------------------------------------------------------------------
    // Project Library Save
    // ----------------------------------------------------------------------------------
    function saveProjectToLibrary(projectCode, projectTitle) {

        $.ajax({
            url: "php/sptl.php",
            type: "POST",
            data: {
                pc: projectCode,
                pt: projectTitle
            },
            cache: false,
            error: function() {
                // console.log("Error Connecting");
            },
            success: function(d) {
                // console.log(d);
            }
        });

    }

    var graphDraw = {

        started: false,
        firstPoint: {
            col: 0,
            row: 0
        },

        state: undefined,
        graph: undefined,
        straight: false,
        sx: undefined,
        sy: undefined,
        lx: undefined,
        ly: undefined,
        commit: false,
        pointCommit: false,
        drawCommit: false,
        lineStarted: false,

        onMouseDown: function() {

            let graph = app.mouse.down.graph;
            let mouse = getGraphMouse(graph, app.mouse.x, app.mouse.y);
            let which = app.mouse.down.which;

            if (which !== 1 && which !== 3) return;

            let state = which == 1 ? 1 : 0;

            let x = mouse.col - 1;
            let y = mouse.row - 1;

            if (!this.started) {
                this.graph = graph;
                this.state = state;
                this.firstPoint = {
                    col: mouse.col,
                    row: mouse.row
                };
                Selection.get(graph).pointState = this.state;
                Selection.get(graph).points = [];
                this.started = true;
                this.mouseMoved = false;
                this.pointCommit = false;
                this.drawCommit = false;
                this.lineStarted = false;
                this.checkMouseMove = true;
            }

            if (!this.lineStarted) {
                this.sx = x;
                this.sy = y;
                Selection.get(graph).addPoint(this.sx, this.sy);
                Selection.get(graph).lineEnds[0] = [this.sx, this.sy];
                Selection.get(graph).lineEnds[1] = [this.sx, this.sy];
                this.lineStarted = true;
            } else {
                this.lx = x;
                this.ly = y;
                if (this.straight)[this.lx, this.ly] = getCoordinatesOfStraightLastPoint(this.sx, this.sy, x, y);
                Selection.get(graph).lineEnds[1] = [this.lx, this.ly];
                this.pointCommit = true;
            }

        },

        onMouseMove: function() {

            if (!q.graph.tool.in("line", "brush") || !this.started) return;

            let graph = this.graph;
            let drawMouse = getGraphMouse(graph, app.mouse.x, app.mouse.y);
            if (this.checkMouseMove && (drawMouse.col !== this.firstPoint.col || drawMouse.row !== this.firstPoint.row)) {
                this.mouseMoved = true;
            }

            if (this.mouseMoved) {
                this.pointCommit = true;
            }

            let x = drawMouse.col - 1;
            let y = drawMouse.row - 1;

            if (q.graph.tool == "line") {
                this.lx = x;
                this.ly = y;
                if (this.straight)[this.lx, this.ly] = getCoordinatesOfStraightLastPoint(this.sx, this.sy, x, y);
                Selection.get(graph).lineEnds[1] = [this.lx, this.ly];
                Selection.get(graph).needsUpdate = true;
            } else if (q.graph.tool == "brush") {
                Selection.get(graph).addPoint(x, y);
            } else {
                return false;
            }

        },

        onMouseUp: function() {

            if (!q.graph.tool.in("line", "brush") || !this.started) return;

            let graph = this.graph;
            let drawMouse = getGraphMouse(graph, app.mouse.x, app.mouse.y);
            let x = drawMouse.col - 1;
            let y = drawMouse.row - 1;
            this.lx = x;
            this.ly = y;

            this.dragMode = this.mouseMoved;
            this.checkMouseMove = false;

            if (q.graph.tool == "line" && this.pointCommit) {

                if (this.straight)[this.lx, this.ly] = getCoordinatesOfStraightLastPoint(this.sx, this.sy, x, y);
                Selection.get(graph).addPoint(this.lx, this.ly);

                if (this.dragMode) {
                    this.drawCommit = true;

                } else {

                    if (this.sx == this.lx && this.sy == this.ly) {
                        this.drawCommit = true;
                    }

                    this.sx = this.lx;
                    this.sy = this.ly;
                    this.lx = x;
                    this.ly = y;
                    if (this.straight)[this.lx, this.ly] = getCoordinatesOfStraightLastPoint(this.sx, this.sy, x, y);
                    Selection.get(graph).lineEnds[0] = [this.sx, this.sy];
                    Selection.get(graph).lineEnds[1] = [this.lx, this.ly];
                    Selection.get(graph).needsUpdate = true;
                    this.lineStarted = true;

                }

                if (this.drawCommit) {
                    this.commitPoints();
                }

            } else if (q.graph.tool == "brush") {
                this.commitPoints();

            }

        },

        reset: function() {
            Selection.resetPoints();
            this.started = false;
        },

        commitPoints: function() {
            let graph = this.graph;
            let maxW = Selection.get(graph).pointsMaxX + 1;
            let maxH = Selection.get(graph).pointsMaxY + 1;
            let curW = q.graph.width(graph);
            let curH = q.graph.height(graph);

            if (maxW > curW || maxH > curH) {
                let seamlessX = lookup(graph, ["weave", "threading"], [gp.seamlessWeave, gp.seamlessThreading]);
                let seamlessY = lookup(graph, ["weave", "lifting"], [gp.seamlessWeave, gp.seamlessLifting]);
                let xOverflow = seamlessX ? "loop" : "extend";
                let yOverflow = seamlessY ? "loop" : "extend";
                let tile = q.graph.get(graph);
                let newW = seamlessX ? curW : Math.max(curW, maxW);
                let newH = seamlessY ? curH : Math.max(curH, maxH);
                console.log([curW, curH, newW, newH]);
                let canvas = newArray2D8(0, newW, newH);
                let res = paste2D8(tile, canvas);
                q.graph.set(0, graph, res, {
                    render: false,
                    trim: false,
                    propagate: false
                });
            }

            Selection.get(graph).points.forEach(function(v, i) {
                q.graph.setPoint(graph, v[0] + 1, v[1] + 1, graphDraw.state, false, true);
            });
            q.graph.set(0, graph);
            Selection.resetPoints();
            this.started = false;
        },

        render: function() {
            this.onMouseMove();
            Selection.needsUpdate = true;
        }

    };

    // ----------------------------------------------------------------------------------
    // User Management System
    // ----------------------------------------------------------------------------------
    var globalUser = {

        authenticated: false,
        current: -1,

        load: function() {
            return new Promise((resolve, reject) => {
                $.doTimeout("onAuthStateChanged", 1000, function() {
                    if (q.user.current !== -1) {
                        resolve(q.user.current);
                        return false;
                    }
                    return true;
                });
            });
        },

        // q.user.init
        init: function() {
            fb.auth.onAuthStateChanged(function(user) {
                q.user.current = user;
                if (user) {
                    q.user.onLogin(user);
                } else {
                    q.user.onLogout();
                }
            });
        },

        get: function() {
            return fb.auth.currentUser;
        },

        registerInstance: function() {

        },

        onLogin: async function(user) {
            q.user.authenticated = true;
        },

        onLogout: function() {
            q.user.authenticated = false;
            q.user.signOut();
        },

        signOut() {
            fb.auth.signOut().then(function() {
                console.log("signout.success");
                window.location.replace("../signin.php");
                return true;
            }).catch(function(error) {
                console.log("signout.error");
            });
        },

        get displayName() {
            return fb.auth.currentUser.displayName;
        },

        set displayName(text) {
            XWin.progress("userProfile", true);
            this.current.updateProfile({
                displayName: text
            }).then(() => {
                XWin.progress("userProfile", false);
                XWin.show("userProfile");
            }).catch((error) => {
                XWin.progress("userProfile", false);
                XWin.show("userProfile");
            });
        },

        subscriptionCheck: async function() {
            let userData = await q.user.data;
            if (userData) {
                console.log(userData);
                let days = userData.subscription.remainingDays;
                console.log(days);
                let time = userData.subscription.remaining;
                if (!app.alertDialog || app.alertDialog.isClosed()) {
                    app.alert("red", "Subscription expiring soon", time + " remaining");
                }
            }
        },

        setPermissions: function(data){
            let userAuthorNameReadonly = !data.allow_author_change;
            $('#user-author-name').prop("readonly", userAuthorNameReadonly).prop("disabled", userAuthorNameReadonly);
            let btnSave = $('#user-profile-modal .xprimary');
            if ( userAuthorNameReadonly ){ btnSave.hide(); } else { btnSave.show(); }
        },

        bindFirestoreEvents: function() {

            var userDataRef = fb.fs.collection("users").doc(q.user.current.email);
            
            // Set the "capital" field of the city 'DC'
            userDataRef.update({
                force_reset: false
            }).then(() => {
                //console.log("Document successfully updated!");
            }).catch((error) => {
                // The document probably doesn't exist.
                //console.error("Error updating document: ", error);
            });

            // Check user data change
            userDataRef.onSnapshot((doc) => {
                let data = doc.data();
                if (data.force_reset) {
                    window.location.reload();
                }
                q.user.setPermissions(data);
            });

            // Subscription expiring alert
            // $.doTimeout("subscriptionCheck", 60000, function() {
            //     q.user.subscriptionCheck();
            //     return true;
            // });

        },

        get data() {
            return new Promise((resolve, reject) => {
                if (typeof firebase == 'undefined') resolve(false);
                let userDataRef = fb.fs.collection("users").doc(q.user.current.email);
                userDataRef.get().then((doc) => {
                    if (doc.exists) {
                        let data = doc.data();
                        if (data) {
                            console.log("q.user.data.true");
                            let expiryMoment = moment(data.subscription_expiry.toDate());
                            let expiry = expiryMoment.utc().format("ddd, DD MMM YYYY HH:mm:ss") + " GMT";
                            let serverMoment = moment(firebase.firestore.Timestamp.now().toDate());
                            let remainingDays = moment.duration(expiryMoment.diff(serverMoment)).asDays();
                            let remaining = decimalDaysToDaysAndHours(remainingDays);
                            data.subscription = { expiry, remaining, remainingDays };
                            resolve(data);

                        } else {
                            console.log("q.user.data.true");
                            resolve(false);
                        }
                    } else {
                        console.log("q.user.data.notfound");
                        resolve(false);
                    }
                }).catch((error) => {
                    console.log("Error getting document:", error);
                    console.log("q.user.data.error");
                    resolve(false);
                });
            });
        },

    };

    // ----------------------------------------------------------------------------------
    // Model Object & Methods
    // ----------------------------------------------------------------------------------

    // All dimentions in Meters Scale 10;

    var globalModel = {

        needsUpdate: false,

        renderer: undefined,
        scene: undefined,
        camera: undefined,
        controls: undefined,
        gltfLoader: undefined,
        raycaster: undefined,
        composer: undefined,

        model: undefined,
        modelMeshes: [],

        sceneCreated: false,

        fps: [],

        lights: {},
        maxAnisotropy: 16,
        models: {},

        _tool: "pointer",
        get tool() {
            return this._tool;
        },
        set tool(value) {
            setToolbarTwoStateButtonGroup("model", "modelTools", value);
            if (this._tool == value) return;
            this._tool = value;
        },

        // Model
        params: {

            controlsType: "", //"orbit", "trackball"
            controlsNear: 1,
            controlsFar: 36,

            animationQue: 0,

            roomW: 60, // 60dm
            roomH: 27, // 27dm

            cameraFov: 45,
            cameraNear: 0.1,
            cameraFar: 85,

            // Auto Rotation
            autoRotate: false,
            allowAutoRotate: true,
            rotationSpeed: 0.01,
            rotationDirection: 1,

            roomMeshId: undefined,
            featureWallMeshId: undefined,
            modelUVMapWmm: undefined,
            modelUVMapHmm: undefined,

            prevState: {
                modelId: undefined,
                roomShape: undefined,
                wallTexture: undefined,
                envAmbiance: undefined,
                featureWall: undefined,
            },

            viewPresets: {

                current: "initScene",
                initScene: undefined,
                initModel: undefined,
                user: undefined,

                update: function(preset) {
                    let _this = q.model;
                    this[preset] = {
                        modelRotation: [0, 0, 0],
                        cameraUp: _this.camera.up.toArray(),
                        cameraPos: _this.camera.position.toArray(),
                        cameraRotation: _this.camera.rotation.toArray(),
                        controlsTarget: _this.controls.target.toArray(),
                        spotLightTarget: _this.lights.spot.target.position.toArray()
                    };
                    if (_this.model) {
                        let modelRotation = _this.model.rotation.clone();
                        modelRotation.x = normalizeToNearestRotation(modelRotation.x);
                        modelRotation.y = normalizeToNearestRotation(modelRotation.y);
                        modelRotation.z = normalizeToNearestRotation(modelRotation.z);
                        this[preset].modelRotation = modelRotation.toArray();
                    }
                    this.current = "user";
                }

            },

            scene: [
                ["header", "Scene", "modelScene"],
                ["select", "Room", "roomShape", [
                    ["square", "Square"],
                    ["round", "Round"],
                    ["open", "Open"]
                ], {
                    col: "1/2"
                }],
                ["select", "Walls", "wallTexture", [
                    ["plain", "Plain"],
                    ["rough", "Rough"],
                    ["bricks", "Bricks"],
                    ["vintage", "Vintage"],
                    ["modern", "Modern"]
                ], {
                    col: "1/2"
                }],
                ["select", "Ambiance", "envAmbiance", [
                    ["bright", "Bright"],
                    ["dark", "Dark"]
                ], {
                    col: "1/2"
                }],
                ["check", "Feature Wall", "featureWall", 0],
                ["select", "Feature Wall Texture", "featureWallTexture", [
                    ["plain", "Plain"],
                    ["rough", "Rough"],
                    ["bricks", "Bricks"],
                    ["vintage", "Vintage"],
                    ["modern", "Modern"]
                ], {
                    col: "1/2"
                }],
                ["select", "Background", "bgType", [
                    ["solid", "Solid"],
                    ["gradient", "Gradient"],
                    ["transparent", "Transparent"],
                    ["image", "Image"]
                ], {
                    col: "1/2"
                }],
                ["color", "Background Color", "bgColor", "#FFFFFF", {
                    col: "1/3"
                }],
                ["color", "Fog Color", "fogColor", "#FFFFFF", {
                    col: "1/3"
                }],
                ["range", "Fog Density", "fogDensity", 0, {
                    col: "1/1",
                    min: 0,
                    max: 1,
                    step: 0.01
                }],
                ["select", "Right Button Control", "rightClickControl", [
                    ["camera", "Camera"],
                    ["target", "Target"]
                ], {
                    col: "1/2"
                }],
                ["control"]
            ],

            lights: [
                ["header", "Lighting"],
                ["range", "Temperature", "lightTemperature", 6600, {
                    col: "1/1",
                    min: 2700,
                    max: 7500,
                    step: 100
                }],
                ["range", "Ambient", "ambientLight", 0.5, {
                    col: "1/1",
                    min: 0,
                    max: 1,
                    step: 0.05,
                    precision: 2
                }],
                ["range", "Directional", "directionalLight", 0.5, {
                    col: "1/1",
                    min: 0,
                    max: 1,
                    step: 0.05,
                    precision: 2
                }],
                ["range", "Point", "pointLight", 0.5, {
                    col: "1/1",
                    min: 0,
                    max: 1,
                    step: 0.05,
                    precision: 2
                }],
                ["range", "Spot", "spotLight", 0.5, {
                    col: "1/1",
                    min: 0,
                    max: 1,
                    step: 0.05,
                    precision: 2
                }],
                ["range", "Feature Spot", "featureSpotLight", 0.5, {
                    col: "1/1",
                    min: 0,
                    max: 1,
                    step: 0.05,
                    precision: 2
                }],
                ["range", "Camera Focus", "cameraFocus", 18, {
                    col: "1/1",
                    min: 0,
                    max: 360,
                    step: 1
                }],
                ["control"]
            ],

            view: [
                ["range", "Model Y", "objectY", 0, {
                    col: "1/1",
                    min: -100,
                    max: 100,
                    step: 0.1,
                    precision: 1
                }],
                ["range", "Camera X", "cameraX", 0, {
                    col: "1/1",
                    min: -100,
                    max: 100,
                    step: 0.1,
                    precision: 1
                }],
                ["range", "Camera Y", "cameraY", 0, {
                    col: "1/1",
                    min: -100,
                    max: 100,
                    step: 0.1,
                    precision: 1
                }],
                ["range", "Camera Z", "cameraZ", 0, {
                    col: "1/1",
                    min: -100,
                    max: 100,
                    step: 0.1,
                    precision: 1
                }],
                ["range", "Target X", "targetX", 0, {
                    col: "1/1",
                    min: -100,
                    max: 100,
                    step: 0.1,
                    precision: 1
                }],
                ["range", "Target Y", "targetY", 0, {
                    col: "1/1",
                    min: -100,
                    max: 100,
                    step: 0.1,
                    precision: 1
                }],
                ["range", "Target Z", "targetZ", 0, {
                    col: "1/1",
                    min: -100,
                    max: 100,
                    step: 0.1,
                    precision: 1
                }],
                ["control"]
            ],

            effects: [
                ["check", "Bokeh", "effectBokeh", 1],
                ["range", "Focus", "effectBokehFocus", 0, {
                    col: "1/1",
                    min: 0,
                    max: 3000,
                    step: 1
                }],
                ["range", "Aperture", "effectBokehAperture", 0.5, {
                    col: "1/1",
                    min: 0,
                    max: 10,
                    step: 0.025
                }],
                ["range", "Max Blur", "effectBokehMaxBlur", 0.025, {
                    col: "1/1",
                    min: 0,
                    max: 3,
                    step: 0.005
                }],

                ["check", "SSAO", "effectSSAO", 1],
                ["range", "Kernel Radius", "effectSSAOKernelRadius", 0.15, {
                    col: "1/1",
                    min: 0,
                    max: 32,
                    step: 0.01
                }],
                ["range", "Min Distance", "effectSSAOMinDistance", 0.005, {
                    col: "1/1",
                    min: 0.001,
                    max: 0.020,
                    step: 0.001
                }],
                ["range", "Max Distance", "effectSSAOMaxDistance", 0.1, {
                    col: "1/1",
                    min: 0.01,
                    max: 0.30,
                    step: 0.01
                }],

                ["check", "SAO", "effectSAO", 1],
                ["range", "SAOBias", "effectSAOBias", 0.01, {
                    col: "1/1",
                    min: -1,
                    max: 1,
                    step: 0.01
                }],
                ["range", "SAOIntensity", "effectSAOIntensity", 0.0012, {
                    col: "1/1",
                    min: 0,
                    max: 1,
                    step: 0.0001
                }],
                ["range", "SAOScale", "effectSAOScale", 0.3, {
                    col: "1/1",
                    min: 0,
                    max: 10,
                    step: 0.01
                }],
                ["range", "SAOKernelRadius", "effectSAOKernelRadius", 40, {
                    col: "1/1",
                    min: 1,
                    max: 100,
                    step: 0.01
                }],
                ["range", "SAOMinResolution", "effectSAOMinResolution", 0, {
                    col: "1/1",
                    min: 0,
                    max: 1,
                    step: 0.01
                }],
                ["check", "SAOBlur", "effectSAOBlur", 1],
                ["range", "SAOBlurRadius", "effectSAOBlurRadius", 4, {
                    col: "1/1",
                    min: 0,
                    max: 200,
                    step: 1
                }],
                ["range", "SAOBlurStdDev", "effectSAOBlurStdDev", 4, {
                    col: "1/1",
                    min: 0.5,
                    max: 150,
                    step: 0.01
                }],
                ["range", "SAOBlurDepthCutoff", "effectSAOBlurDepthCutoff", 0.01, {
                    col: "1/1",
                    min: 0,
                    max: 0.1,
                    step: 0.01
                }],

                ["control"]
            ],

            materialProps: [
                ["dynamicHeader", false, "materialSelectedId", false, {
                    col: "3/5"
                }],
                ["number", "Texture Width", "materialMapWidth", 100, {
                    precision: 2
                }],
                ["number", "Texture Height", "materialMapHeight", 100, {
                    precision: 2
                }],
                ["number", "Offset X", "materialMapOffsetX", 0],
                ["number", "Offset Y", "materialMapOffsetY", 0],
                ["select", "Dimension Units", "materialMapUnit", [
                    ["mm", "mm"],
                    ["cm", "cm"],
                    ["inch", "Inch"]
                ]],
                ["angle", "Rotation (deg)", "materialMapRotationDeg", 0, {
                    min: 0,
                    max: 360
                }],
                ["select", "Bump", "materialBumpMap", [
                    ["flat", "Flat"],
                    ["woven", "Woven"],
                    ["knitted", "Knitted"]
                ]],
                ["color", "Color", "materialColor", "#FFFFFF", {
                    col: "2/3"
                }],
                ["control", "play"]
            ]

        },

        images: {

            url: "model/images/",

            canvas_bump: {
                file: "fabric_bump.png",
                wmm: 25.4,
                hmm: 25.4,
                ends: 60,
                picks: 50,
                val: undefined
            },

            knitted_bump: {
                file: "knitted_bump_02.png",
                wmm: 25.4,
                hmm: 25.4,
                ends: 60,
                picks: 50,
                val: undefined
            },

            get: function(id, callback) {
                var _images = this;
                if (_images[id].val == undefined) {
                    var url = _images.url + _images[id].file;
                    _images.load(url, function(img) {
                        _images[id].val = img;
                        callback();
                    });
                } else {
                    callback();
                }
            },

            load: function(url, callback) {
                var img = new Image();
                img.onload = function() {
                    if (typeof callback === "function") {
                        callback(img);
                    }
                };
                img.onerror = function() {
                    // console.log("loadImage.error: "+url)
                };
                img.src = url;
            }

        },

        weaveTextures: {

        },

        imageTextures: {

        },

        textures: {

            needsUpdate: true,
            pending: 0,
            folder: "model/images/",

            url: {

                test_bright: "test_bright.png",
                test_dark: "test_dark.png",
                test_bump: "test_bump.png",

                checker: "checker.png",

                plain_bright: "plain_bright.png",
                plain_dark: "plain_dark.png",
                plain_bump: "plain_bump.png",

                rough_bright: "rough_bright.jpg",
                rough_dark: "rough_dark.png",
                rough_bump: "rough_bump.png",

                bricks_bright: "bricks_bright.png",
                bricks_dark: "bricks_dark.png",
                bricks_bump: "bricks_bump.png",

                vintage_bright: "vintage_bright.jpg",
                vintage_dark: "vintage_dark.png",
                vintage_bump: "vintage_bump.png",

                modern_bright: "modern_bright.png",
                modern_dark: "modern_dark.png",
                modern_bump: "modern_bump.png",

                canvas: "canvas.png",
                canvas_bump: "fabric_bump.png",

                wood: "wood_white_texture.png",
                wood_bump: "wood_white_bump.png",

                marble_light: "marble_light.jpg",
                marble_medium: "marble_medium.jpg",
                marble_dark: "marble_dark.jpg",

                carpet_bright: "carpet_bright.jpg",
                carpet_dark: "carpet_dark.jpg",
                carpet_bump: "carpet_bump.jpg",

                woven_texture: "canvas.jpg",
                woven_bump: "fabric_bump.png",

                knitted_fabric: "fabric_bump.jpg",
                knitted_bump: "knitted_bump.jpg",

                image_texture: "checker.png",
                image_bump: "checker.png",

            },

            thumbs: {

            }

        },

        counter: {
            weave: 0,
            image: 0
        },
        materials: {},

        setMaterial: async function(name, newProps, callback) {

            let _this = this;

            if (newProps == undefined) newProps = {};

            // If Material is already created and there is no change in props
            if (_this.materials[name] !== undefined) {
                let _material = _this.materials[name];
                let isMaterialChanged = false;
                for (let key in newProps) {
                    if (_material[key] == undefined || _material[key] !== newProps[key]) isMaterialChanged = true;
                }
                if (!isMaterialChanged) {
                    if (typeof callback === "function") callback();
                    return;
                }

            } else {
                _this.materials[name] = {};

            }

            var _material = _this.materials[name];
            setDefaultMaterialProps(_material);

            // Reset Material if existing material type is different
            if (newProps.type !== undefined && newProps.type !== _material.type && _material.val) {
                _material.val.dispose();
                _material.val = undefined;
            }

            // Update material Props from direct props
            for (let key in newProps) {
                if (newProps[key] === "undefined" && _material[key] !== undefined) {
                    _material[key] = undefined;
                } else {
                    _material[key] = newProps[key];
                }
            }

            // get old props from exisiting materisl
            if (newProps.needsUpdate) {
                for (let key in _material) newProps[key] = _material[key];
                _material.needsUpdate = undefined;
            }

            if (_material.val == undefined) {
                if (_material.type == "lambert") _material.val = new THREE.MeshLambertMaterial();
                else if (_material.type == "phong") _material.val = new THREE.MeshPhongMaterial();
                else if (_material.type == "standard") _material.val = new THREE.MeshStandardMaterial();
                else if (_material.type == "physical") _material.val = new THREE.MeshPhysicalMaterial();
                _material.val.name = name;
            }

            _material.val.color.set(_material.color);
            _material.val.side = THREE[_material.side];

            var mapRotation = toRadians(_material.map_rotationdeg);

            var unitMultiplier = lookup(_material.map_unit, ["mm", "cm", "inch"], [1, 1 / 10, 1 / 25.4]);
            var mapRepeats_x = _material.uv_width_mm / _material.map_width * unitMultiplier;
            var mapRepeats_y = _material.uv_height_mm / _material.map_height * unitMultiplier;

            var mapOffset_x = -_material.map_offsetx / _material.map_width;
            var mapOffset_y = _material.map_offsety / _material.map_height;

            // Direct material props do not need to be set by a function and are applied only as object property value.
            let directMaterialProps = ["depthTest", "bumpScale", "roughness", "metalness", "reflectivity", "emissive", "dithering", "transmission", "transparent", "opacity", "specular", "shininess"];
            directMaterialProps.forEach(key => {
                if (_material[key] !== undefined) _material.val[key] = _material[key];
            });

            var mapData = gop(newProps, "map");
            var bumpMapData = gop(newProps, "bumpMap");
            var thumb = gop(newProps, "thumb");

            if (mapData == null && _material.map && _material.val.map == undefined) mapData = _material.map;
            if (bumpMapData == null && _material.bumpMap && _material.val.bumpMap == undefined) bumpMapData = _material.bumpMap;

            if (mapData !== null) {
                if (mapData == undefined) {
                    _material.map = undefined;
                    _material.val.map = undefined;
                    _material.thumb = undefined;

                } else {
                    let texture = await this.getTexture(name, mapData);
                    _material.val.map = texture;
                    _material.thumb = thumb ? thumb : imageToDataurl(texture.image, 48, 48);
                    _this.setTextureProps(_material.val.map, mapRepeats_x, mapRepeats_y, mapOffset_x, mapOffset_y, mapRotation, "repeat", _material.flipY);
                }
                _material.val.needsUpdate = true;
                q.model.needsUpdate = true;
                app.wins.materials.tabs.system.domNeedsUpdate = true;
                XWin.render("setMaterial", "materials", "system");
            }

            if (bumpMapData !== null) {
                if (bumpMapData == undefined) {
                    _material.bumpMap = undefined;
                    _material.val.bumpMap = undefined;
                } else {
                    let texture = await this.getTexture(name, bumpMapData);
                    _material.val.bumpMap = texture;
                    _this.setTextureProps(_material.val.bumpMap, mapRepeats_x, mapRepeats_y, mapOffset_x, mapOffset_y, mapRotation, "repeat", _material.flipY);
                }
                _material.val.needsUpdate = true;
                q.model.needsUpdate = true;
            }

            if (_material.val.map && mapData == null) {
                _this.setTextureProps(_material.val.map, mapRepeats_x, mapRepeats_y, mapOffset_x, mapOffset_y, mapRotation, "repeat", _material.flipY);
                _material.val.map.needsUpdate = true;
            }

            if (_material.val.bumpMap && bumpMapData == null) {
                _this.setTextureProps(_material.val.bumpMap, mapRepeats_x, mapRepeats_y, mapOffset_x, mapOffset_y, mapRotation, "repeat", _material.flipY);
                _material.val.bumpMap.needsUpdate = true;
            }

            _material.val.needsUpdate = true;
            q.model.needsUpdate = true;

            if (typeof callback === "function") callback();

        },

        getTexture: function(name, data, needsUpdate = false) {

            let _this = this;
            var _textures = _this.textures;
            let loading = false;

            return new Promise((resolve, reject) => {

                var data_type = textureType(data);

                if (data_type == "name") name = data;

                if (_textures[name] === Object(_textures[name]) && needsUpdate) _textures[name] = undefined;

                if (_textures[name] === Object(_textures[name])) {
                    resolve(_textures[name].clone());

                } else if (data_type == "texture") {
                    resolve(data);

                } else if (_textures[name] == "initiated") {
                    $.doTimeout(10, function() {
                        if (_textures[name] !== "initiated") {
                            resolve(_textures[name].clone());
                            return false;
                        }
                        return true;
                    });

                } else if (data_type == "dataurl") {
                    loading = true;

                } else if (data_type == "url") {
                    data = _textures.folder + data;
                    loading = true;

                } else if (data_type == "name") {
                    data = _textures.folder + _textures.url[name];
                    loading = true;

                } else {
                    resolve(undefined);

                }

                if (loading) {
                    _textures[name] = "initiated";
                    _this.textureLoader.load(data, function(texture) {
                        _textures[name] = texture;
                        resolve(texture);
                    });
                }

            });

        },

        setTextureProps: function(map, repeat_x, repeat_y, offset_x, offset_y, rotation, wrap, flipY) {

            if (map == undefined) return;

            var setRepeat = repeat_x && repeat_y;
            var setOffset = offset_x !== null && offset_y !== null;
            var setRotation = rotation !== null;

            if (setRepeat) map.repeat.set(repeat_x, repeat_y);
            if (setOffset) map.offset.set(offset_x, offset_y);
            if (setRotation) map.rotation = rotation;

            if (wrap == "mirror") {
                map.wrapS = THREE.MirroredRepeatWrapping;
                map.wrapT = THREE.MirroredRepeatWrapping;
            } else if (wrap == "repeat") {
                map.wrapS = THREE.RepeatWrapping;
                map.wrapT = THREE.RepeatWrapping;
            }

            map.flipY = flipY;
            map.encoding = THREE.sRGBEncoding;
            map.anisotropy = this.maxAnisotropy;

            map.needsUpdate = true;

        },

        // q.model.setInterface:
        setInterface: async function(instanceId = 0, render = true) {

            //console.log(["q.model.setInterface", instanceId]);
            //logTime("q.model.setInterface("+instanceId+")");

            var modelBoxL = 0;
            var modelBoxB = 0;

            var modelBoxW = app.frame.width - modelBoxL;
            var modelBoxH = app.frame.height - modelBoxB;

            $("#model-container").css({
                "width": modelBoxW,
                "height": modelBoxH,
                "left": modelBoxL,
                "bottom": modelBoxB,
            });

            q.position.update("model");

            if (app.views.active !== "model" || !render) return;

            await q.model.createScene();

            q.model.renderer.setSize(app.frame.width, app.frame.height);
            q.model.camera.aspect = app.frame.width / app.frame.height;
            q.model.composer.setSize(app.frame.width, app.frame.height);
            q.model.camera.updateProjectionMatrix();

            if (mp.controlsType == "trackball") q.model.controls.handleResize();

            q.model.needsUpdate = true;

            //logTimeEnd("q.model.setInterface("+instanceId+")");

        },

        createControls: function(type) {

            let _this = this;

            if (type == mp.controlsType) return;
            mp.controlsType = type;
            let currentCameraPos = mp.viewPresets.initScene.cameraPos;
            let currentControlsTarget = mp.viewPresets.initScene.controlsTarget;

            if (_this.controls) {
                currentCameraPos = _this.camera.position.toArray();
                currentControlsTarget = _this.controls.target.toArray();
                _this.controls.dispose();
            }

            if (type == "orbit" || true) {
                _this.controls = new THREE.OrbitControls(_this.camera, _this.renderer.domElement);
                _this.controls.minPolarAngle = 0;
                _this.controls.maxPolarAngle = Math.PI;

            } else if (type == "trackball") {
                _this.controls = new THREE.TrackballControls(_this.camera, _this.renderer.domElement);
                _this.controls.staticMoving = true;
                _this.controls.dynamicDampingFactor = 0;
                _this.controls.rotateSpeed = 4;
                _this.controls.zoomSpeed = 3;
                _this.controls.panSpeed = 0.8;

            }

            _this.controls.minDistance = mp.controlsNear;
            _this.controls.maxDistance = mp.controlsFar;
            _this.controls.mouseButtons = {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN
            };

            _this.camera.position.set(...currentCameraPos);
            _this.controls.target.set(...currentControlsTarget);
            _this.controls.update();
            q.model.needsUpdate = true;

            _this.controls.addEventListener("change", function() {
                q.model.needsUpdate = true;
            });

            _this.controls.addEventListener("start", function() {});

            _this.controls.addEventListener("end", function() {
                if (!mp.animationQue) mp.viewPresets.update("user");
                q.model.needsUpdate = true;
            });

        },

        setBackground: async function() {
            if (!this.scene) return;
            await setSceneBackground(this.renderer, this.scene, "#model-container", mp.bgType, mp.bgColor);
            q.model.needsUpdate = true;
        },

        // q.model.setLights
        setLights: function() {

            let _this = this;
            var _lights = this.lights;
            var _roomW = mp.roomW;
            var _roomH = mp.roomH;

            var kelvin = mp.lightTemperature;
            var lh_rgb = kelvinToRGB(kelvin);
            var lh = rgb_hex(lh_rgb.r, lh_rgb.g, lh_rgb.b, "0x");
            lh = parseInt(lh, 16);

            var ai = 1 * mp.ambientLight;
            var pi = 60 * mp.pointLight;
            var si = 200 * mp.spotLight;
            var fi = 50 * mp.featureSpotLight;
            var di = 1.5 * mp.directionalLight;

            // _lights.directional0 = new THREE.DirectionalLight( 0xffffff, 1);
            // _lights.directional0.position.set(_roomW, _roomH, _roomW);
            // this.scene.add( _lights.directional0 );

            // _lights.directional1 = new THREE.DirectionalLight( 0xffffff, 1);
            // _lights.directional0.position.set(-_roomW, _roomH, -_roomW);
            // this.scene.add( _lights.directional0 );

            if (!_lights.ambient && mp.ambientLight) {
                _lights.ambient = new THREE.AmbientLight(lh, ai);
                this.scene.add(_lights.ambient);
            } else if (_lights.ambient) {
                _lights.ambient.visible = mp.ambientLight;
                _lights.ambient.intensity = ai;
                _lights.ambient.color.setHex(lh);
            }

            if (!this.lights.point1 && mp.pointLight) {

                var disp = mp.roomW / 3;
                var lightH = _roomH - 0.05;

                ["point1", "point2", "point3", "point4", "point5"].forEach(v => {
                    _lights[v] = new THREE.PointLight(lh, pi, 50, 1);
                    _this.scene.add(_lights[v]);

                });

                _lights.point1.position.set(0, lightH, 0);
                _lights.point2.position.set(disp, lightH, disp);
                _lights.point3.position.set(disp, lightH, -disp);
                _lights.point4.position.set(-disp, lightH, disp);
                _lights.point5.position.set(-disp, lightH, -disp);

            } else if (this.lights.point1) {

                ["point1", "point2", "point3", "point4", "point5"].forEach(v => {
                    _lights[v].visible = mp.pointLight;
                    _lights[v].intensity = pi;
                    _lights[v].color.setHex(lh);
                });

            }

            if (!_lights.spot && mp.spotLight) {
                // SpotLight( color, intensity, distance, angle, penumbra, decay )
                _lights.spot = new THREE.SpotLight(lh, si, 50, 0.3, 1, 1);
                _lights.spot.position.set(16, 24, 16);
                _lights.spot.castShadow = true;
                _lights.spot.target = new THREE.Object3D(0, 0, 0);
                _lights.spot.target.position.set(0, 0, 0);
                _lights.spot.shadow.bias = -0.0001;
                _lights.spot.radius = 10;
                this.scene.add(_lights.spot.target);
                this.scene.add(_lights.spot);
                _lights.spot.shadow.mapSize.width = 512;
                _lights.spot.shadow.mapSize.height = 512;
                _lights.spot.shadow.camera.near = 0.5;
                _lights.spot.shadow.camera.far = 85;
            } else if (_lights.spot) {
                _lights.spot.visible = mp.spotLight;
                _lights.spot.intensity = si;
                _lights.spot.color.setHex(lh);
            }

            if (!_lights.featureSpot && mp.featureSpotLight) {
                // SpotLight( color, intensity, distance, angle, penumbra, decay )
                _lights.featureSpot = new THREE.SpotLight(lh, fi, 250, 0.65, 0.5, 1);
                _lights.featureSpot.position.set(0, _roomH, 0);
                _lights.featureSpot.castShadow = true;
                _lights.featureSpot.target = new THREE.Object3D(0, 0, 0);
                _lights.featureSpot.target.position.set(0, _roomH / 4, -_roomW / 2);
                _lights.featureSpot.shadow.bias = -0.0001;
                _lights.featureSpot.radius = 10;
                this.scene.add(_lights.featureSpot.target);
                this.scene.add(_lights.featureSpot);
                _lights.featureSpot.shadow.mapSize.width = 512;
                _lights.featureSpot.shadow.mapSize.height = 512;
                _lights.featureSpot.shadow.camera.near = 0.5;
                _lights.featureSpot.shadow.camera.far = 85;
            } else if (_lights.featureSpot) {
                _lights.featureSpot.visible = mp.featureSpotLight;
                _lights.featureSpot.intensity = fi;
                _lights.featureSpot.color.setHex(lh);
            }

            if (!_lights.directional && mp.directionalLight) {
                _lights.directional = new THREE.DirectionalLight(lh, di);
                _lights.directional.position.set(0, mp.roomH / 2, mp.roomW / 4);
                this.scene.add(_lights.directional);
            } else if (_lights.directional) {
                _lights.directional.visible = mp.directionalLight;
                _lights.directional.intensity = di;
                _lights.directional.color.setHex(lh);
            }

            q.model.needsUpdate = true;

        },

        sceneSetup: function() {

            let _this = this;

            _this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                preserveDrawingBuffer: true
            });

            _this.renderer.setPixelRatio(q.pixelRatio);
            _this.renderer.setSize(app.frame.width, app.frame.height);
            _this.renderer.shadowMap.enabled = true;
            _this.renderer.shadowMapSoft = true;
            _this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            _this.renderer.shadowMap.bias = 0.0001;

            _this.renderer.outputEncoding = THREE.sRGBEncoding;

            _this.renderer.physicallyCorrectLights = true;
            _this.maxAnisotropy = _this.renderer.capabilities.getMaxAnisotropy();

            var container = document.getElementById("model-container");
            container.innerHTML = "";
            container.appendChild(_this.renderer.domElement);
            _this.renderer.domElement.id = "modelDisplay";
            $("#modelDisplay").addClass('graph-canvas');
            q.canvas.modelDisplay = _this.renderer.domElement;

            // scene
            _this.scene = new THREE.Scene();

            // camera
            _this.camera = new THREE.PerspectiveCamera(mp.cameraFov, app.frame.width / app.frame.height, mp.cameraNear, mp.cameraFar);
            _this.scene.add(_this.camera); //required, since camera has a child light

            // raycaster
            _this.raycaster = new THREE.Raycaster();

            _this.gltfLoader = new THREE.GLTFLoader();
            _this.textureLoader = new THREE.TextureLoader();

            // Helpers
            // _this.scene.add( new THREE.AxesHelper( 2 ) );
            // _this.scene.add(new THREE.CameraHelper(_this.camera));
            // _this.scene.add( new THREE.SpotLightHelper( _this.lights.spot ) );

            mp.viewPresets.initScene = {
                modelRotation: [0, 0, 0],
                cameraUp: [0, 1, 0],
                cameraPos: [0, mp.roomH / 2, mp.roomW * 0.6],
                cameraRotation: [0, 0, 0],
                controlsTarget: [0, mp.roomH / 2, 0],
                spotLightTarget: [0, 0, 0]
            };

            // By default controls will be orbitcontrol
            _this.createControls("orbit");

            if (_this.lights.spot) {
                _this.lights.spot.target.position.set(...mp.viewPresets.initScene.spotLightTarget);
            }

            _this.controls.update();

            _this.composerSetup();

            q.model.needsUpdate = true;

        },

        // Model
        createScene: function() {
            return new Promise(async(resolve, reject) => {
                if (!q.model.sceneCreated) {
                    q.model.sceneSetup();
                    await app.wins.materials.loadSystemItems();
                    app.wins.materials.tabs.system.domNeedsUpdate = true;
                    q.model.setEnvironment();
                }
                resolve();
            });
        },

        pass: {
            render: function() {
                q.model.renderPass = new THREE.RenderPass(q.model.scene, q.model.camera);
                q.model.renderPass.clearColor = new THREE.Color(0, 0, 0);
                q.model.renderPass.clearAlpha = 0;
                q.model.composer.addPass(q.model.renderPass);
                // q.model.renderPass.clear = false;	
            },
            bokeh: function() {
                q.model.bokehPass = new THREE.BokehPass(q.model.scene, q.model.camera, {
                    focus: 0,
                    aperture: 0.5 * 0.00001,
                    maxblur: 0.025,
                    width: app.frame.width,
                    height: app.frame.height
                });
                q.model.composer.addPass(q.model.bokehPass);
                q.model.bokehPass.needsSwap = true;
            },
            fxaa: function() {
                q.model.fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
                q.model.fxaaPass.uniforms.resolution.value.set(1 / app.frame.width, 1 / app.frame.height);
                q.model.fxaaPass.renderToScreen = true;
                q.model.fxaaPass.material.transparent = true; // FIX
                q.model.composer.addPass(q.model.fxaaPass);
            },
            gamma: function() {
                var gammaCorrectionPass = new THREE.ShaderPass(THREE.GammaCorrectionShader);
                q.model.composer.addPass(gammaCorrectionPass);
            }
        },

        composerSetup: function() {

            // postprocessing
            var parameters = {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                stencilBuffer: false,
                type: THREE.FloatType
            };
            var renderTarget = new THREE.WebGLRenderTarget(app.frame.width, app.frame.height, parameters);
            q.model.composer = new THREE.EffectComposer(q.model.renderer, renderTarget, parameters);

            q.model.pass.render();

            if (mp.bgType !== "transparent") {
                // q.model.pass.bokeh();
                // q.model.pass.fxaa();
                // q.model.pass.gamma();
            }

            // q.model.saoPass = new THREE.SAOPass( q.model.scene, q.model.camera, false, true );
            // q.model.composer.addPass( q.model.saoPass );

            // q.model.saoPass.resolution.set(2048, 2048);
            //    q.model.saoPass.params.saoBias = .01;
            //    q.model.saoPass.params.saoIntensity = .0003;
            //    q.model.saoPass.params.saoScale = .3;
            //    q.model.saoPass.params.saoKernelRadius = 40;
            //    q.model.saoPass.params.saoBlurRadius = 4;
            //    q.model.saoPass.params.saoMinResolution = 0;

            // q.model.ssaoPass = new THREE.SSAOPass( q.model.scene, q.model.camera, app.frame.width, app.frame.height );
            // q.model.composer.addPass( q.model.ssaoPass );
            // q.model.ssaoPass.kernelRadius = 0.1;
            // q.model.ssaoPass.minDistance = 0.005;
            // q.model.ssaoPass.maxDistance = 0.1;

        },

        setEnvironment: async function(callback) {

            let _this = this;
            var areaRatio, roomWidth, roomHeight, xRepeats, yRepeats, xOffset, yOffset;

            _this.setBackground();

            _this.scene.fog = new THREE.FogExp2(new THREE.Color(mp.fogColor), mp.fogDensity * 0.05);

            var changeRoomShape = mp.roomShape !== mp.prevState.roomShape;
            if (changeRoomShape && mp.roomMeshId !== undefined) {
                _this.disposeObjectById(mp.roomMeshId);
                mp.roomMeshId = undefined;
            }

            if (mp.roomShape.in("square", "round")) {

                var textureTileWmm = lookup(mp.wallTexture, ["plain", "rough", "bricks", "vintage", "modern"], [600, 1500, 600, 600, 1000]);
                var textureTileHmm = lookup(mp.wallTexture, ["plain", "rough", "bricks", "vintage", "modern"], [600, 1500, 600, 600, 635.3]);

                let wallW, roomRadius;

                if (mp.roomShape == "square") {
                    areaRatio = 1;
                    roomWidth = mp.roomW;
                    wallW = roomWidth * 100; // roomWidth (dm) to wallW (mm);

                } else if (mp.roomShape == "round") {
                    areaRatio = 4 / Math.PI;
                    roomRadius = mp.roomW * 4 / 2 / Math.PI;
                    roomWidth = roomRadius * 2;
                    wallW = roomWidth * Math.PI * 100; // roomWidth (dm) to wallW (mm);

                }

                roomHeight = mp.roomH;
                let wallH = roomHeight * 100;

                _this.setMaterial("wall", {
                    uv_width_mm: wallW,
                    uv_height_mm: wallH,
                    map_width: textureTileWmm,
                    map_height: textureTileHmm,
                    map: mp.wallTexture + "_" + mp.envAmbiance,
                    bumpMap: mp.wallTexture + "_bump"
                });

                // xOffset = - xRepeats % 2 / 2;
                // yOffset = - yRepeats % 2 / 2;

                _this.setMaterial("floor", {
                    uv_width_mm: roomWidth * 100,
                    uv_height_mm: roomWidth * 100,
                    map: mp.wallTexture == "plain" ? "plain_" + mp.envAmbiance : "carpet_" + mp.envAmbiance,
                    bumpMap: mp.wallTexture == "plain" ? "plain_bump" : "carpet_bump"
                });

                // xOffset = - xRepeats % 2 / 2;
                // yOffset = - yRepeats % 2 / 2;

                _this.setMaterial("ceiling", {
                    uv_width_mm: roomWidth * 100,
                    uv_height_mm: roomWidth * 100,
                    map: "plain_" + mp.envAmbiance,
                });

                var w = _this.materials.wall.val;
                var f = _this.materials.floor.val;
                var c = _this.materials.ceiling.val;

                var room_material = mp.roomShape == "round" ? [w, f, c] : [w, w, f, c, w, w];

                var room_mesh;

                if (changeRoomShape) {

                    var room_geometry;
                    if (mp.roomShape == "round") {
                        room_geometry = new THREE.CylinderBufferGeometry(roomRadius, roomRadius, roomHeight, 64);
                    } else if (mp.roomShape == "square") {
                        room_geometry = new THREE.BoxBufferGeometry(roomWidth, roomHeight, roomWidth);
                    }
                    room_mesh = new THREE.Mesh(room_geometry, room_material);
                    mp.roomMeshId = room_mesh.id;
                    _this.scene.add(room_mesh);
                    room_mesh.receiveShadow = true;
                    room_mesh.position.set(0, roomHeight / 2, 0);
                    room_mesh.rotation.x = Math.PI;
                    if (mp.roomShape == "round") room_mesh.rotation.y = toRadians(90);

                } else {

                    room_mesh = _this.scene.getObjectById(mp.roomMeshId);
                    room_mesh.material = room_material;

                }

                if (mp.featureWall) _this.setFeatureWall();

            }

            if (!mp.featureWall || mp.roomShape == "open") {

                _this.disposeObjectById(mp.featureWallMeshId);
                mp.featureWallMeshId = undefined;
                mp.featureWall = false;

            }

            // if ( mp.roomShape == "open" ){
            // 	_this.createControls("trackball");
            // } else {
            // 	_this.createControls("orbit");
            // }

            _this.createControls("orbit");

            mp.prevState.roomShape = mp.roomShape;
            mp.prevState.wallTexture = mp.wallTexture;
            mp.prevState.envAmbiance = mp.envAmbiance;
            mp.prevState.featureWall = mp.featureWall;
            mp.prevState.featureWallTexture = mp.featureWallTexture;

            this.setLights();

            // Feature Wall Spot Light Position
            if (mp.featureSpotLight) {
                let lightPos = [0, roomHeight / 4, -roomWidth / 2];
                if (mp.featureWall) lightPos = [0, roomHeight / 4 * 0.75, -roomWidth / 4];
                _this.lights.featureSpot.target.position.set(...lightPos);
            }
            _this.sceneCreated = true;
            q.model.needsUpdate = true;

        },

        setFeatureWall: function() {

            let _this = this;
            var feature_mesh = _this.scene.getObjectById(mp.featureWallMeshId);

            var featureW = mp.roomW * 0.5;
            var featureH = mp.roomH * 0.75;
            var featureL = 1.12;

            var textureTileWmm = lookup(mp.featureWallTexture, ["plain", "rough", "bricks", "vintage", "modern"], [600, 1500, 600, 600, 1000]);
            var textureTileHmm = lookup(mp.featureWallTexture, ["plain", "rough", "bricks", "vintage", "modern"], [600, 1500, 600, 600, 635.3]);

            var featureWallOptions = {
                map: mp.featureWallTexture + "_" + mp.envAmbiance,
                bumpMap: mp.featureWallTexture + "_bump",
                uv_width_mm: featureW * 100,
                uv_height_mm: featureH * 100,
                map_width: textureTileWmm,
                map_height: textureTileHmm
            };

            _this.setMaterial("plainWall", {}, function(material) {

                if (mp.featureWallMeshId == undefined) {

                    var feature_geometry = new THREE.BoxBufferGeometry(featureW, featureH, featureL);
                    feature_mesh = new THREE.Mesh(feature_geometry, _this.materials.plainWall.val);
                    feature_mesh.receiveShadow = true;
                    feature_mesh.castShadow = true;
                    feature_mesh.position.set(0, featureH / 2, -mp.roomW / 4);
                    mp.featureWallMeshId = feature_mesh.id;
                    _this.scene.add(feature_mesh);
                    q.model.needsUpdate = true;

                } else {

                    feature_mesh.material = _this.materials.plainWall.val;

                }

                _this.setMaterial("featureWall", featureWallOptions, function(material) {
                    var w = _this.materials.plainWall.val;
                    var f = _this.materials.featureWall.val;
                    feature_mesh.material = [w, w, w, w, f, w];
                    q.model.needsUpdate = true;
                });

            });

        },

        disposeObjectById: function(id) {
            if (id == undefined) return;
            var o = this.scene.getObjectById(id);
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                if (o.material.length) {
                    for (let i = 0; i < o.material.length; ++i) o.material[i].dispose();
                } else {
                    o.material.dispose();
                }
            }
            this.scene.remove(o);
            o = undefined;
            q.model.needsUpdate = true;
        },

        importModel_old: async function(file) {
            let _this = this;
            let arrayBuffer = file.data;
            _this.gltfLoader.parse(arrayBuffer, '', function(gltf) {
                _this.model = gltf.scene;
                _this.scene.add(_this.model);
            }, function(errormsg) {
                console.error(errormsg);
            });

        },

        importModel: async function(file) {

            let _this = this;

            await q.model.createScene();
            _this.removeModel();
            mp.allowAutoRotate = false;

            let arrayBuffer = file.data;
            _this.gltfLoader.parse(arrayBuffer, '', async function(gltf) {

                    _this.model = gltf.scene;
                    _this.scene.add(_this.model);

                    let sceneData = _this.model.userData;

                    let sceneDataDefaults = {
                        title: "No Name",
                        UVMapWmm: 2400,
                        UVMapHmm: 2400,
                        modelRotation: [0, 0, 0],
                        cameraUp: [0, 1, 0],
                        cameraPos: [0, mp.roomH / 2, mp.roomW * 0.6],
                        cameraRotation: [0, 0, 0],
                        controlsTarget: [0, mp.roomH / 2, 0],
                        spotLightTarget: [0, 0, 0]
                    };

                    for (let key in sceneDataDefaults) {
                        if (sceneData[key] == undefined) sceneData[key] = sceneDataDefaults[key];
                    }

                    _this.modelMeshes.length = 0;

                    _this.model.traverse(function(node) {
                        if (node.isMesh) {
                            _this.modelMeshes.push(node);
                            node.receiveShadow = true;
                            node.castShadow = true;
                        }
                    });

                    _this.model.scale.set(1, 1, 1);
                    _this.model.position.set(...sceneData.modelPos);

                    mp.viewPresets.initModel = {
                        modelRotation: sceneData.modelRotation,
                        cameraUp: sceneData.cameraUp,
                        cameraPos: sceneData.cameraPos,
                        cameraRotation: sceneData.cameraRotation,
                        controlsTarget: sceneData.controlsTarget,
                        spotLightTarget: sceneData.spotLightTarget
                    };

                    mp.viewPresets.initScene.spotLightTarget = sceneData.spotLightTarget;
                    mp.viewPresets.initScene.controlsTarget = sceneData.controlsTarget;

                    mp.viewPresets.current = "initModel";
                    mp.modelUVMapWmm = sceneData.UVMapWmm;
                    mp.modelUVMapHmm = sceneData.UVMapHmm;

                    var loadingbar1 = new Loadingbar("applyMaterials", "Loading Materials");
                    await _this.applyDefaultMaterials();
                    loadingbar1.remove();
                    await _this.animateModelSceneTo(mp.viewPresets.initModel);
                    q.model.needsUpdate = true;
                    _this.postCreate();

                },
                function(errormsg) {
                    console.error(errormsg);

                });

        },

        setModel: async function(modelId) {

            var sceneData = q.model.models[modelId];

            if (sceneData) {

                let sceneDataDefaults = {
                    title: "No Name",
                    UVMapWmm: 2400,
                    UVMapHmm: 2400,
                    modelRotation: [0, 0, 0],
                    cameraUp: [0, 1, 0],
                    cameraPos: [0, mp.roomH / 2, mp.roomW * 0.6],
                    cameraRotation: [0, 0, 0],
                    controlsTarget: [0, mp.roomH / 2, 0],
                    spotLightTarget: [0, 0, 0]
                };

                for (let key in sceneDataDefaults) {
                    if (sceneData[key] == undefined) sceneData[key] = sceneDataDefaults[key];
                }

                let _this = this;
                var folder = "model/objects/";
                var isNewLoading = true;

                if (isNewLoading) {

                    mp.viewPresets.initModel = {
                        modelRotation: sceneData.modelRotation,
                        cameraUp: sceneData.cameraUp,
                        cameraPos: sceneData.cameraPos,
                        cameraRotation: sceneData.cameraRotation,
                        controlsTarget: sceneData.controlsTarget,
                        spotLightTarget: sceneData.spotLightTarget
                    };
                    mp.viewPresets.initScene.spotLightTarget = sceneData.spotLightTarget;
                    mp.viewPresets.initScene.controlsTarget = sceneData.controlsTarget;

                    mp.viewPresets.current = "initModel";
                    mp.modelUVMapWmm = sceneData.UVMapWmm;
                    mp.modelUVMapHmm = sceneData.UVMapHmm;

                    await q.model.createScene();

                    _this.removeModel();
                    mp.allowAutoRotate = false;
                    mp.prevState.modelId = modelId;
                    var url = folder + sceneData.file;
                    var loadingbar = new Loadingbar("setModel", "Loading Model");

                    _this.gltfLoader.load(url, async function(gltf) {

                            _this.model = gltf.scene;
                            _this.scene.add(_this.model);

                            _this.modelMeshes.length = 0;

                            _this.model.traverse(function(node) {
                                if (node.isMesh) {
                                    _this.modelMeshes.push(node);
                                    node.receiveShadow = true;
                                    node.castShadow = true;
                                }
                            });

                            _this.model.position.set(...sceneData.modelPos);
                            _this.model.scale.set(1, 1, 1);

                            var loadingbar1 = new Loadingbar("applyMaterials", "Loading Materials");
                            await _this.applyMaterialList(sceneData.materialList);
                            loadingbar1.remove();
                            await _this.animateModelSceneTo(mp.viewPresets.initModel);
                            if (mp.controlsType == "trackball") _this.controls.handleResize();
                            q.model.needsUpdate = true;
                            _this.postCreate();

                        },
                        function(xhr) {
                            loadingbar.progress = Math.round(xhr.loaded / xhr.total * 100);

                        },
                        function(error) {
                            console.error(error);

                        });

                }

            } else {
                console.log("Model data missing");

            }

        },

        changeView: async function() {

            if (!this.sceneCreated) return;

            let doChange = true;
            let current = mp.viewPresets.current;

            if (current == "initScene" && !this.model && mp.viewPresets.user) {
                current = "user";

            } else if (current == "initScene" && this.model) {
                current = "initModel";

            } else if (current == "initModel" && mp.viewPresets.user) {
                current = "user";

            } else if (current == "initModel" && !mp.viewPresets.user) {
                current = "initScene";

            } else if (current == "user") {
                current = "initScene";

            } else {
                doChange = false;

            }

            if (doChange) {
                await this.animateModelSceneTo(mp.viewPresets[current]);
                mp.viewPresets.current = current;
            }

        },

        animateModelSceneTo: function(p) {

            let _this = this;

            app.views.model.toolbar.disableItem("toolbar-model-change-view");

            return new Promise((resolve, reject) => {

                mp.animationQue++;
                _this.controls.enabled = false;

                let animationTime = 1.5; // seconds
                let animationEase = Power4.easeInOut;

                var tl = new TimelineLite({
                    delay: 0,
                    onComplete: function() {
                        _this.controls.enabled = true;
                        mp.allowAutoRotate = true;
                        mp.animationQue--;
                        _this.camera.up.set(...p.cameraUp);
                        _this.camera.updateProjectionMatrix();
                        _this.controls.update();
                        app.views.model.toolbar.enableItem("toolbar-model-change-view");
                        q.model.needsUpdate = true;
                        resolve();
                        Debug.item("Timeline.Status", "complete", "model");

                    },
                    onUpdate: function() {

                        // let startCenter = _this.controls.target.clone();
                        // let startPos = new THREE.Vector3().copy(_this.camera.position);
                        // let startDir = new THREE.Vector3().subVectors( startCenter, startPos ).normalize();

                        // let endCenter = new THREE.Vector3().fromArray(p.controlsTarget);
                        // let endPos = new THREE.Vector3().fromArray(p.cameraPos);
                        // let endDir = new THREE.Vector3().subVectors( endCenter, endPos ).normalize();

                        // let normal = new THREE.Vector3().copy(startDir).cross(endDir).normalize();

                        // let angleToRotate = startDir.angleTo(endDir);
                        // let angle = angleToRotate * progress.value;

                        // // console.log(roundTo(progress.value*100,1) + ": " + roundTo(toDegrees(angleEnd), 1));

                        // _this.camera.position.copy(startPos).applyAxisAngle(normal, angle);

                        // //_this.camera.position.copy(AtStartPosition).applyAxisAngle(AtNormal, AtAngleToRotate * progress.value);

                        // let currentDistanceToCenter = _this.camera.position.distanceTo( startCenter )
                        // let targetDistanceToCenter = endPos.distanceTo( endCenter );
                        // let distanceToTravel = targetDistanceToCenter - currentDistanceToCenter;
                        // let displacementDirection = new THREE.Vector3().subVectors( _this.camera.position.clone(), startCenter ).normalize();
                        // let displacement = distanceToTravel * progress.value;
                        // _this.camera.position.add(displacementDirection.clone().multiplyScalar(displacement));
                        _this.camera.lookAt(_this.controls.target);
                        q.model.needsUpdate = true;
                        Debug.item("Timeline.Status", "updating", "model");
                    }

                });

                if (_this.model && p.modelRotation) {
                    mp.autoRotate = false;
                    app.views.model.toolbar.setItemState("toolbar-model-rotate", false);
                    this.model.rotation.y = normalizeToNearestRotation(this.model.rotation.y);
                    tl.add(TweenLite.to(_this.model.rotation, animationTime, {
                        x: p.modelRotation[0],
                        y: p.modelRotation[1],
                        z: p.modelRotation[2],
                        ease: animationEase
                    }), 0);
                }

                if (p.cameraPos) {
                    tl.add(TweenLite.to(_this.camera.position, animationTime, {
                        x: p.cameraPos[0],
                        y: p.cameraPos[1],
                        z: p.cameraPos[2],
                        ease: animationEase
                    }), 0);
                }

                if (p.cameraRotation) {
                    tl.add(TweenLite.to(_this.camera.rotation, animationTime, {
                        x: p.cameraRotation[0],
                        y: p.cameraRotation[1],
                        z: p.cameraRotation[2],
                        ease: animationEase
                    }), 0);
                }

                if (p.controlsTarget) {
                    tl.add(TweenLite.to(_this.controls.target, animationTime, {
                        x: p.controlsTarget[0],
                        y: p.controlsTarget[1],
                        z: p.controlsTarget[2],
                        ease: animationEase
                    }), 0);
                }

                if (p.spotLightTarget) {
                    tl.add(TweenLite.to(_this.lights.spot.target.position, animationTime, {
                        x: p.spotLightTarget[0],
                        y: p.spotLightTarget[1],
                        z: p.spotLightTarget[2],
                        ease: animationEase
                    }), 0);
                }

            });

        },

        removeModel: function() {

            if (this.model) {

                for (var i = this.model.children.length - 1; i >= 0; i--) {
                    this.scene.remove(this.model.children[i]);
                    //this.model.children[i].geometry.dispose();
                    //this.model.children[i].material.dispose();
                }
                this.scene.remove(this.model);
                this.model = undefined;
            }

        },

        fillCanvasWithTileImage: function(baseCanvas, tileImage, canvasWmm, canvasHmm, tileImageWmm, tileImageHmm, callback) {
            var canvasWpx = baseCanvas.width;
            var canvasHpx = baseCanvas.height;
            var imgWpx = tileImage.width;
            var imgHpx = tileImage.height;
            var copyWpx = imgWpx;
            var copyHpx = imgHpx;
            if (canvasWmm < tileImageWmm) {
                copyWpx = Math.round(canvasWmm / tileImageWmm * imgWpx);
            }
            if (canvasHmm < tileImageHmm) {
                copyHpx = Math.round(canvasHmm / tileImageHmm * imgHpx);
            }
            var tileWpx = Math.round(canvasWpx * tileImageWmm / canvasWmm);
            var tileHpx = Math.round(canvasHpx * tileImageHmm / canvasHmm);
            var tile_ctx = q.ctx(61, "noshow", "fill-tile-image", tileWpx, tileHpx);
            tile_ctx.drawImage(tileImage, 0, 0, copyWpx, copyHpx, 0, 0, tileWpx, tileHpx);
            var base = baseCanvas.getContext("2d");
            var pattern = base.createPattern(tile_ctx.canvas, "repeat");
            base.rect(0, 0, canvasWpx, canvasHpx);
            base.fillStyle = pattern;
            base.fill();
            //saveCanvasAsImage(g_tempCanvas, "bump.png");
            // console.log({canvasWmm:canvasWmm, canvasHmm:canvasHmm, canvasW:canvasW, canvasH:canvasH, imgW:imgW, imgH:imgH, imgWmm:imgWmm, imgHmm:imgHmm, copyW:copyW, copyH:copyH, tileW:tileW, tileH:tileH});
            callback();
        },

        fillCanvasWithTile: function(baseCanvas, tileImageId, canvasWmm, canvasHmm, callback) {

            let _this = this;
            _this.images.get(tileImageId, function() {
                var img = _this.images[tileImageId];
                var canvasW = baseCanvas.width;
                var canvasH = baseCanvas.height;
                var imgW = img.val.width;
                var imgH = img.val.height;
                var imgWmm = img.wmm;
                var imgHmm = img.hmm;
                var copyW = imgW;
                var copyH = imgH;
                if (canvasWmm < imgWmm) {
                    copyW = Math.round(canvasWmm / imgWmm * imgW);
                }
                if (canvasHmm < imgHmm) {
                    copyH = Math.round(canvasHmm / imgHmm * imgH);
                }
                var tileW = Math.round(canvasW * imgWmm / canvasWmm);
                var tileH = Math.round(canvasH * imgHmm / canvasHmm);
                var tile = q.ctx(61, "noshow", "fill-tile", tileW, tileH);
                tile.drawImage(img.val, 0, 0, copyW, copyH, 0, 0, tileW, tileH);
                var base = baseCanvas.getContext("2d");
                var pattern = base.createPattern(tile.canvas, "repeat");
                base.rect(0, 0, canvasW, canvasH);
                base.fillStyle = pattern;
                base.fill();
                //saveCanvasAsImage(g_tempCanvas, "bump.png");
                // console.log({canvasWmm:canvasWmm, canvasHmm:canvasHmm, canvasW:canvasW, canvasH:canvasH, imgW:imgW, imgH:imgH, imgWmm:imgWmm, imgHmm:imgHmm, copyW:copyW, copyH:copyH, tileW:tileW, tileH:tileH});
                callback();
            });
        },

        createFabricBumpTexture: function(canvas, imageId, canvasWmm, canvasHmm, callback) {
            let _this = this;
            _this.fillCanvasWithTile(canvas, imageId, canvasWmm, canvasHmm, function() {
                var texture = _this.createCanvasTexture(canvas);
                callback(texture);
            });
        },

        drawImageToCanvas: function(image, canvas) {

            // console.log("drawImageToCanvas");

            var ctx = canvas.getContext("2d");
            var pattern = ctx.createPattern(image, "repeat");
            ctx.rect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = pattern;
            ctx.fill();

        },

        getImageById: function(imageId, callback) {

            // console.log("getImageById");

            let _this = this;
            var _url = _this.images.folder + _this.images.url[imageId];
            var _image = _this.images[imageId];
            if (_image == undefined) {
                _this.loadImage(_url, function(img) {
                    _this.images[imageId] = img;
                    callback(_this.images[imageId]);
                });
            } else {
                callback(_this.images[imageId]);
            }

        },

        loadImage: function(url, callback) {

            let _this = this;
            var img = new Image();
            img.onload = function() {
                if (typeof callback === "function") {
                    callback(img);
                }
            };
            img.onerror = function() {
                // console.log("loadImage.error: "+url)
            };
            img.src = url;

        },

        createImageMaterial: function() {
            let _this = this;
            openFileDialog("image", "Texture").then(file => {
                _this.createCanvasMaterial_async({
                    type: "image",
                    image: file.image,
                    dataurl: file.dataurl,
                    file: file.name
                });
            });
        },

        createWeaveMaterial: function() {

            let _this = this;

            var renderW = q.simulation.renderingSize.width;
            var renderH = q.simulation.renderingSize.height;

            let canvasW = renderW.px;
            let canvasH = renderW.px;
            let xScale = 1;
            let yScale = 1;

            if (sp.mode == "scaled") {
                canvasW = Math.min(q.limits.maxTextureSize, nearestPow2(renderW.px));
                canvasH = Math.min(q.limits.maxTextureSize, nearestPow2(renderH.px));
                xScale = canvasW / renderW.px * sp.zoom;
                yScale = canvasH / renderH.px * sp.zoom;
            }

            let ctx_map = q.ctx(61, "noshow", "modelTextureMap", canvasW, canvasH, true, false);
            let loadingbar = new Loadingbar("simulationRenderTo", "Preparing Simulation", true, true);

            q.simulation.renderTo(ctx_map, canvasW, canvasH, 0, 0, xScale, yScale, sp.renderQuality, async function() {
                let ctx_output = q.ctx(61, "noshow", "canvas_simulation_output", canvasW, canvasH, true, false);
                await picaResize(ctx_map, ctx_output);
                let weaveImg = new Image();
                weaveImg.onload = function() {
                    _this.createCanvasMaterial({
                        type: "weave",
                        image: weaveImg,
                        map_width: renderW.mm,
                        map_height: renderH.mm
                    });
                };
                weaveImg.src = ctx_output.canvas.toDataURL("image/png");
                loadingbar.remove();
            });

        },

        createColorMaterial: function(params) {

            let _this = this;

            let id = ++app.wins.materials.counter.color;
            let color = tinycolor.random();
            let colorName = ntc.name(color.toHexString())[1];

            var matProps = {
                id: id,
                name: "color_" + id,
                title: "Color " + id,
                type: "physical",
                color: color.toHexString(),
                bumpScale: 0.01,
                roughness: 1,
                metalness: 0,
                reflectivity: 0,
                side: "DoubleSide",
                show: 1,
                edit: 1,
                info: colorName,
                thumb_data: false,
                wmm: 25.4,
                hmm: 25.4,
                tab: "user",
                edit_button_class: "btn-edit-material"
            };

            _this.setMaterial(matProps.name, matProps, function() {
                app.wins.materials.tabs.user.domNeedsUpdate = true;
                XWin.show("materials.user");
            });

        },

        createCanvasMaterial_async: function(options) {

            let _this = this;

            var type = options.type;
            var index = ++q.model.counter[type];
            var title = type + " " + leftPadNum(index, 3);
            var id = type + "_" + leftPadNum(index, 3);

            var color = gop(options, "color", "#FFFFFF");
            var info = gop(options, "file", "");
            var image = options.image;
            var imageW = image.width;
            var imageH = image.height;

            var imageWmm = Math.round(imageW / sp.screenDPI * 25.4);
            var imageHmm = Math.round(imageH / sp.screenDPI * 25.4);

            var map_width = gop(options, "map_width", imageWmm);
            var map_height = gop(options, "map_height", imageHmm);

            var canvasW = Math.min(q.limits.maxTextureSize, nearestPow2(imageW));
            var canvasH = Math.min(q.limits.maxTextureSize, nearestPow2(imageH));

            var mapContext = q.ctx(61, "noshow", "mapCanvas", canvasW, canvasH);
            mapContext.drawImage(image, 0, 0, imageW, imageH, 0, 0, canvasW, canvasH);
            var map = mapCanvas.toDataURL("image/png");

            var thumbW = 96;
            var thumbH = 96;
            var thumbContext = q.ctx(61, "noshow", "thumbCanvas", thumbW, thumbH);
            thumbContext.drawImage(image, 0, 0, imageW, imageH, 0, 0, thumbW, thumbH);
            var thumb = thumbCanvas.toDataURL("image/png");

            var bumpMapImageId = gop(options, "bumpMapImageId", "canvas_bump");
            var bumpMapContext = q.ctx(61, "noshow", "bumpCanvas", canvasW, canvasH);

            _this.createFabricBumpTexture(bumpMapContext.canvas, bumpMapImageId, map_width, map_height, function(bumpMap) {

                var matProps = {
                    id: id,
                    name: id,
                    title: title,
                    type: "physical",
                    color: color,
                    bumpScale: 0.01,
                    roughness: 1,
                    metalness: 0,
                    reflectivity: 0,
                    side: "DoubleSide",
                    show: 1,
                    edit: 1,
                    info: info,
                    map_width: map_width,
                    map_height: map_height,
                    map_width_default: map_width,
                    map_height_default: map_height,
                    map: map,
                    bumpMap: bumpMap,
                    thumb: thumb,
                    tab: "user"
                };

                _this.setMaterial(matProps.name, matProps, function() {
                    app.wins.materials.tabs.user.domNeedsUpdate = true;
                    XWin.show("materials.user");
                });

            });

        },

        createCanvasMaterial: async function(options) {

            let _this = this;

            var type = options.type;
            var index = ++q.model.counter[type];
            var title = type + " " + leftPadNum(index, 3);
            var id = type + "_" + leftPadNum(index, 3);

            var color = gop(options, "color", "#FFFFFF");
            var info = gop(options, "file", "");
            var image = options.image;
            var imageW = image.width;
            var imageH = image.height;

            var imageWmm = Math.round(imageW / sp.screenDPI * 25.4);
            var imageHmm = Math.round(imageH / sp.screenDPI * 25.4);

            var map_width = gop(options, "map_width", imageWmm);
            var map_height = gop(options, "map_height", imageHmm);

            var canvasW = Math.min(q.limits.maxTextureSize, nearestPow2(imageW));
            var canvasH = Math.min(q.limits.maxTextureSize, nearestPow2(imageH));

            var mapContext = q.ctx(61, "noshow", "mapCanvas", canvasW, canvasH);
            mapContext.drawImage(image, 0, 0, imageW, imageH, 0, 0, canvasW, canvasH);
            var map = mapCanvas.toDataURL("image/png");

            var thumbW = 48;
            var thumbH = 48;

            let thumbContext = q.ctx(61, "noshow", "thumbCanvas", thumbW, thumbH, false, false);
            await picaResize(mapContext, thumbContext);

            var thumb = q.canvas.thumbCanvas.toDataURL("image/png");

            var matProps = {
                id: id,
                name: id,
                title: title,
                type: "physical",
                color: color,
                bumpScale: 0.01,
                roughness: 1,
                metalness: 0,
                reflectivity: 0,
                side: "DoubleSide",
                show: 1,
                edit: 1,
                info: info,
                map_width: map_width,
                map_height: map_height,
                map_width_default: map_width,
                map_height_default: map_height,
                map: map,
                thumb: thumb,
                tab: "user",
                edit_button_class: "btn-edit-material"
            };

            _this.setMaterial(matProps.name, matProps, function() {
                app.wins.materials.tabs.user.domNeedsUpdate = true;
                XWin.show("materials.user");
            });

        },

        createCanvasMaterial_old: function(options) {

            let _this = this;
            var _materials = _this.materials;

            var type = options.type; //weave, image
            var rnd = convertBase(Date.now().toString(), 10, 62);
            var title = type + "_" + rnd;
            var color = gop(options, "color", "#C9C0C6");
            var bumpMapImageId = gop(options, "bumpMapImageId", "canvas_bump");
            var wmm = gop(options, "wmm", 190);
            var hmm = gop(options, "hmm", 190);
            var info = gop(options, "file", "");

            var image = options.image;
            var imageW = image.width;
            var imageH = image.height;
            var canvasW = Math.min(q.limits.maxTextureSize, nearestPow2(imageW));
            var canvasH = Math.min(q.limits.maxTextureSize, nearestPow2(imageH));
            var xRepeats = mp.modelUVMapWmm / wmm;
            var yRepeats = mp.modelUVMapHmm / hmm;
            var mapContext = q.ctx(61, "noshow", "mapCanvas", canvasW, canvasH);
            mapContext.drawImage(image, 0, 0, imageW, imageH, 0, 0, canvasW, canvasH);

            var thumbW = 96;
            var thumbH = 96;
            var thumbContext = q.ctx(61, "noshow", "thumbCanvas", thumbW, thumbH);
            thumbContext.drawImage(image, 0, 0, imageW, imageH, 0, 0, thumbW, thumbH);
            var thumb_data = thumbCanvas.toDataURL("image/png");

            var matProps = {
                "id": rnd,
                "name": type + "_" + rnd,
                "title": title,
                "type": "physical",
                "color": color,
                "bumpScale": 0.01,
                "roughness": 1,
                "metalness": 0,
                "reflectivity": 0,
                "side": "DoubleSide",
                "show": 1,
                "edit": 1,
                "info": info,
                "thumb_data": thumb_data,
                "wmm": wmm,
                "hmm": hmm
            };

            _this.materials[matProps.name] = matProps;

            var bumpMapContext = temmpCtx("temp", canvasW, canvasH);

            _this.createFabricBumpTexture(bumpMapContext.canvas, bumpMapImageId, wmm, hmm, function(bumpMapTexture) {
                var mapTexture = _this.createCanvasTexture(mapContext.canvas);
                mapTexture.repeat.set(xRepeats, yRepeats);
                _this.setMaterial(matProps.name, matProps);
                _this.materials[matProps.name].val.map = mapTexture;
                _this.materials[matProps.name].val.bumpMap = bumpMapTexture;
                _this.materials[matProps.name].val.needsUpdate = true;
                if (app.wins.materials.tabs.user.data == undefined) {
                    app.wins.materials.tabs.user.data = [];
                }
                app.wins.materials.tabs.user.data.push(matProps);
                app.wins.materials.tabs.user.needsUpdate = true;
                XWin.show("materials.user");
            });

        },

        applyMaterialList_new: function(materialList, callback) {

            let _this = this;

            mp.modelMaterialLoadPending = 0;

            var nodei = 0;
            _this.model.traverse(function(node) {
                if (node.isMesh) {
                    if (materialList[node.name] == undefined) {

                        mp.modelMaterialLoadPending++;
                        _this.setMaterial("white", {}, function() {
                            mp.modelMaterialLoadPending--;
                            node.material = _this.materials.white.val;
                        });
                        Debug.item("OBJ Node-" + nodei, node.name + " - Material Not Set", "model");

                    } else {

                        var n = materialList[node.name];
                        mp.modelMaterialLoadPending++;
                        _this.setMaterial(n, {
                            uv_width_mm: mp.modelUVMapWmm,
                            uv_height_mm: mp.modelUVMapHmm
                        }, function() {
                            mp.modelMaterialLoadPending--;
                            node.material = _this.materials[n].val;
                        });
                        Debug.item("OBJ Node-" + nodei, node.name + " : " + n, "model");

                    }
                    nodei++;
                }
            });

            $.doTimeout(10, function() {
                if (!mp.modelMaterialLoadPending) {
                    if (typeof callback === "function") callback();
                    return false;
                }
                return true;
            });

        },

        applyDefaultMaterials: function() {

            return new Promise((resolve, reject) => {

                let _this = this;

                mp.modelMaterialLoadPending = 0;

                var nodei = 0;

                _this.model.traverse(function(node) {

                    if (node.isMesh) {

                        let nodeUserData = node.userData;

                        if (nodeUserData.material == undefined) {
                            mp.modelMaterialLoadPending++;
                            _this.setMaterial("white", {}, function() {
                                mp.modelMaterialLoadPending--;
                                node.material = _this.materials.white.val;
                            });
                            Debug.item("OBJ Node-" + nodei, node.name + " - Material Not Set", "model");

                        } else {
                            mp.modelMaterialLoadPending++;
                            _this.setMaterial(nodeUserData.material, {
                                uv_width_mm: mp.modelUVMapWmm,
                                uv_height_mm: mp.modelUVMapHmm
                            }, function() {
                                mp.modelMaterialLoadPending--;
                                node.material = _this.materials[nodeUserData.material].val;
                            });
                            Debug.item("OBJ Node-" + nodei, node.name + " : " + nodeUserData.material, "model");

                        }
                        nodei++;
                    }

                });

                $.doTimeout(10, function() {
                    if (!mp.modelMaterialLoadPending) {
                        resolve();
                        return false;
                    }
                    return true;
                });

            });

        },

        applyMaterialList: function(materialList, callback) {

            // console.log("applyMaterialList");

            return new Promise((resolve, reject) => {

                let _this = this;

                mp.modelMaterialLoadPending = 0;

                var nodei = 0;

                _this.model.traverse(function(node) {

                    if (node.isMesh) {

                        if (materialList[node.name] == undefined) {

                            mp.modelMaterialLoadPending++;
                            _this.setMaterial("white", {}, function() {
                                mp.modelMaterialLoadPending--;
                                node.material = _this.materials.white.val;
                            });
                            Debug.item("OBJ Node-" + nodei, node.name + " - Material Not Set", "model");

                        } else {

                            var mat_id = materialList[node.name];
                            mp.modelMaterialLoadPending++;
                            _this.setMaterial(mat_id, {
                                uv_width_mm: mp.modelUVMapWmm,
                                uv_height_mm: mp.modelUVMapHmm
                            }, function() {
                                mp.modelMaterialLoadPending--;
                                node.material = _this.materials[mat_id].val;
                            });
                            Debug.item("OBJ Node-" + nodei, node.name + " : " + mat_id, "model");

                        }
                        nodei++;
                    }

                });

                $.doTimeout(10, function() {
                    if (!mp.modelMaterialLoadPending) {
                        resolve();
                        return false;
                    }
                    return true;
                });

            });

        },

        createCanvasTexture: function(canvas) {

            var texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.encoding = THREE.sRGBEncoding;
            texture.flipY = false;
            texture.anisotropy = 16;
            texture.center.set(0.5, 0.5);
            texture.needsUpdate = true;
            return texture;

        },

        createImageTexture: function(imageData) {

            var texture = new THREE.Texture(imageData);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.encoding = THREE.sRGBEncoding;
            texture.flipY = false;
            texture.anisotropy = 16;
            texture.center.set(0.5, 0.5);
            texture.needsUpdate = true;
            return texture;

        },

        // q.model.render
        render: function() {

            if (this.sceneCreated) {

                this.composer.render();
                //this.renderer.render( this.scene, this.camera );

                var cameraPos = this.camera.position;

                // var cameraPos = q.model.camera.getWorldPosition();

                Debug.item("Camera Position x", Math.round(cameraPos.x * 1000) / 1000, "model");
                Debug.item("Camera Position y", Math.round(cameraPos.y * 1000) / 1000, "model");
                Debug.item("Camera Position z", Math.round(cameraPos.z * 1000) / 1000, "model");

                var cameraRotation = this.camera.rotation;
                Debug.item("Camera Rotation x", Math.round(cameraRotation.x * 1000) / 1000, "model");
                Debug.item("Camera Rotation y", Math.round(cameraRotation.y * 1000) / 1000, "model");
                Debug.item("Camera Rotation z", Math.round(cameraRotation.z * 1000) / 1000, "model");

                var controlsTarget = this.controls.target;
                Debug.item("Controls Target x", Math.round(controlsTarget.x * 1000) / 1000, "model");
                Debug.item("Controls Target y", Math.round(controlsTarget.y * 1000) / 1000, "model");
                Debug.item("Controls Target z", Math.round(controlsTarget.z * 1000) / 1000, "model");

                if (this.model) {
                    var modelRotation = this.model.rotation;
                    Debug.item("Model Rx", Math.round(modelRotation.x * 1000) / 1000, "model");
                    Debug.item("Model Ry", Math.round(modelRotation.y * 1000) / 1000, "model");
                    Debug.item("Model Rz", Math.round(modelRotation.z * 1000) / 1000, "model");
                }

                if (mp.controlsType == "orbit") {
                    Debug.item("Azimuthal", Math.round(this.controls.getAzimuthalAngle() * 1000) / 1000, "model");
                    Debug.item("Polar", Math.round(this.controls.getPolarAngle() * 1000) / 1000, "model");
                } else {
                    Debug.item("Azimuthal", "NA", "model");
                    Debug.item("Polar", "NA", "model");
                }

                var objectPos = new THREE.Vector3(0, 0, 0);
                if (q.model.model) {
                    objectPos.copy(q.model.controls.target);
                }
                var distance = cameraPos.distanceTo(objectPos);

                Debug.item("Camera To Target", Math.round(distance * 1000) / 1000, "model");

            }

        },

        resizeRenderer: function(width, height){
            if (window.devicePixelRatio) {
                this.renderer.setPixelRatio (window.devicePixelRatio);
            }
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix ();
            this.composer.setSize(width, height);
            this.renderer.setSize (width, height);    
            this.render();
        },

        postCreate: function() {

            Debug.item("Geometries", this.renderer.info.memory.geometries, "model");
            Debug.item("Textures", this.renderer.info.memory.textures, "model");
            Debug.item("Calls", this.renderer.info.render.calls, "model");
            Debug.item("Triangles", this.renderer.info.render.triangles, "model");
            Debug.item("Points", this.renderer.info.render.points, "model");
            Debug.item("Lines", this.renderer.info.render.lines, "model");

        },

        // q.model.doMouseInteraction
        doMouseInteraction: function(type, which, canvasMouse) {

            let _this = this;

            var mx = (canvasMouse.x / app.frame.width) * 2 - 1;
            var my = (canvasMouse.y / app.frame.height) * 2 - 1;
            _this.raycaster.setFromCamera({
                x: mx,
                y: my
            }, _this.camera);
            var intersects = _this.raycaster.intersectObjects(_this.modelMeshes, false);
            var isModelUnderMouse = intersects.length;

            let leftMouseButtonDown = type == "mousedown" && which == 1;
            let rightMouseButtonDown = type == "mousedown" && which == 3;

            if (leftMouseButtonDown && isModelUnderMouse && mp.controlsType == "orbit") {
                _this.controls.enabled = false;
                mp.rotateModelWithMouse = true;
                mp.modelStartRotation = q.model.model.rotation.clone();
                mp.allowAutoRotate = false;

            } else if (leftMouseButtonDown && !isModelUnderMouse) {
                _this.controls.enabled = true;
                mp.rotateModelWithMouse = false;
                mp.viewPresets.update("user");

            } else if (rightMouseButtonDown && mp.rightClickControl == "target" && mp.controlsType == "orbit") {
                _this.controls.enabled = true;
                mp.moveControlsTargetWithMouse = true;
                mp.modelStartControlsTargetX = q.model.controls.target.x;
                mp.modelStartControlsTargetY = q.model.controls.target.y;
                mp.viewPresets.update("user");

            } else if (rightMouseButtonDown && mp.rightClickControl == "camera" && mp.controlsType == "orbit") {
                _this.controls.enabled = true;
                mp.moveCameraWithMouse = true;
                mp.modelStartCameraX = q.model.camera.position.x;
                mp.modelStartCameraY = q.model.camera.position.y;
                mp.viewPresets.update("user");

            } else if (type == "mouseup") {
                _this.controls.enabled = true;
                mp.rotateModelWithMouse = false;
                mp.moveControlsTargetWithMouse = false;
                mp.moveCameraWithMouse = false;
                mp.allowAutoRotate = true;
            }

            if (isModelUnderMouse) {

                var hoverMesh = intersects[0];
                var meshName = hoverMesh.object.userData.name;
                var currentNodeMaterialName = hoverMesh.object.material.name;

                MouseTip.show();
                MouseTip.text(0, toTitleCase(meshName.replace(/_/g, ' ')));
                MouseTip.text(1, toTitleCase(hoverMesh.object.material.name.replace(/_/g, ' ')));

                var lib = app.wins.materials;

                if (type == "click" && which == 1 && lib.win !== undefined && !lib.win.isHidden() && lib.itemSelected) {
                    let materialSelected = lib.itemSelected.id;
                    _this.setMaterial(materialSelected, {
                        uv_width_mm: mp.modelUVMapWmm,
                        uv_height_mm: mp.modelUVMapHmm
                    }, function() {
                        hoverMesh.object.material = _this.materials[materialSelected].val;
                        q.model.needsUpdate = true;
                        MouseTip.text(1, toTitleCase(hoverMesh.object.material.name.replace(/_/g, ' ')));
                    });

                } else if (type == "dblclick" && which == 1 && app.wins.materials.win !== undefined && !app.wins.materials.win.isHidden() && app.wins.materials.itemSelected) {
                    let materialSelected = lib.itemSelected.id;
                    _this.setMaterial(materialSelected, {
                        uv_width_mm: mp.modelUVMapWmm,
                        uv_height_mm: mp.modelUVMapHmm
                    }, function() {
                        _this.modelMeshes.forEach(function(node) {
                            if (node.material.name == currentNodeMaterialName) {
                                node.material = _this.materials[materialSelected].val;
                                MouseTip.text(1, toTitleCase(materialSelected.replace(/_/g, ' ')));
                            }
                        });
                        q.model.needsUpdate = true;
                    });

                }

            } else {
                MouseTip.hide();
            }

            if (mp.moveControlsTargetWithMouse) {
                let objectPos = new THREE.Vector3(0, 0, 0);
                let distance = this.camera.position.distanceTo(objectPos);
                let deltaMoveX = app.mouse.x - app.mouse.down.x;
                let deltaMoveY = app.mouse.down.y - app.mouse.y;
                if (q.model.model && app.mouse.isDown) {
                    q.model.controls.target.x = mp.modelStartControlsTargetX - toRadians(deltaMoveX * distance / 18.15);
                    q.model.controls.target.y = mp.modelStartControlsTargetY - toRadians(deltaMoveY * distance / 18.15);
                    q.model.controls.update();
                    q.model.needsUpdate = true;
                }
            }

            if (mp.moveCameraWithMouse) {
                let cameraPos = this.camera.position.clone();
                let objectPos = new THREE.Vector3(0, 0, 0);
                let distance = this.camera.position.distanceTo(objectPos);
                let deltaMoveX = app.mouse.x - app.mouse.down.x;
                let deltaMoveY = app.mouse.down.y - app.mouse.y;
                if (q.model.model && app.mouse.isDown) {
                    q.model.camera.position.x = mp.modelStartCameraX - toRadians(deltaMoveX * distance / 18.15);
                    q.model.camera.position.y = mp.modelStartCameraY - toRadians(deltaMoveY * distance / 18.15);
                    q.model.controls.update();
                    q.model.needsUpdate = true;
                }
            }

            if (mp.rotateModelWithMouse && false) {
                let deltaMoveX = app.mouse.x - app.mouse.down.x;
                let deltaMoveY = app.mouse.y - app.mouse.down.y;
                if (q.model.model && app.mouse.isDown) {
                    q.model.model.rotation.y = mp.modelStartRotation.y + toRadians(deltaMoveX * 0.5);
                    q.model.model.rotation.x = mp.modelStartRotation.x + toRadians(deltaMoveY * 0.5);
                    if (deltaMoveX < 0) {
                        mp.rotationDirection = -1;
                    } else if (deltaMoveX > 0) {
                        mp.rotationDirection = 1;
                    }
                    q.model.needsUpdate = true;
                    mp.viewPresets.update("user");
                }
            }

            if (mp.rotateModelWithMouse) {

                if (q.model.model && app.mouse.isDown) {

                    let objectQuaternion = q.model.model.quaternion;
                    let cameraQuaternion = q.model.camera.quaternion;
                    let deltaQuaterion = cameraQuaternion.clone().invert();
                    deltaQuaterion.multiply(objectQuaternion).normalize().invert();

                    // var gyroTrackingDelta=endOrientation.clone().inverse();
                    // gyroTrackingDelta.multiply(startOrientation);

                    // scene.quaternion.copy(endOrientation).multiply(gyroTrackingDelta);

                    var deltaMove = {
                        x: app.mouse.x - previousMousePosition.x,
                        y: app.mouse.y - previousMousePosition.y
                    };

                    var deltaRotationQuaternion = new THREE.Quaternion()
                        .setFromEuler(new THREE.Euler(
                            toRadians(deltaMove.y * 0.2), toRadians(deltaMove.x * 0.2), 0, 'XYZ'
                        ));

                    q.model.model.quaternion.multiplyQuaternions(deltaRotationQuaternion, q.model.model.quaternion);
                    //q.model.model.quaternion.multiply(deltaQuaterion);

                    //  if ( deltaMoveX < 0 ){
                    //  	mp.rotationDirection = -1;
                    // } else if ( deltaMoveX > 0 ){
                    // 	mp.rotationDirection = 1;
                    // }
                    q.model.needsUpdate = true;
                    mp.viewPresets.update("user");
                }

                previousMousePosition = {
                    x: app.mouse.x,
                    y: app.mouse.y
                };

            }

            _this.controls.update();

        }

    };

    let previousMousePosition = {
        x: 0,
        y: 0
    };

    // ----------------------------------------------------------------------------------
    // Three Object & Methods
    // ----------------------------------------------------------------------------------
    var globalThree = {

        status: {
            scene: false,
            textures: false,
            materials: false,
            fabric: false
        },

        fps: [],

        renderer: undefined,
        scene: undefined,
        camera: undefined,
        controls: undefined,
        model: undefined,
        lights: {
            ambient: undefined,
            point: undefined,
            spot: undefined
        },

        raycaster: new THREE.Raycaster(),

        textures: {

            needsUpdate: true,
            pending: 0,
            threadBumpMap: {
                url: "three/textures/bump_yarn.png",
                val: undefined
            },
            test512: {
                url: "three/textures/uvgrid_01.jpg",
                val: undefined
            }

        },

        materials: {
            needsUpdate: true,
            default: {},
            fabric: {},
            warp: {},
            weft: {}
        },

        fabric: undefined,
        threads: [],
        childIds: [],

        composer: undefined,

        effectFXAA: undefined,
        renderPass: undefined,

        sceneCreated: false,

        animate: false,

        modelParams: {
            initRotation: new THREE.Vector3(0, 0, 0)
        },

        currentPreset: 0,
        rotationPresets: [
            [0, 0, 0],
            [0, 0, -180],
            [0, 0, 0],
            [-90, 0, 0],
            [-90, 90, 0],
            [-30, 45, 0],
            [-30, 0, 0],
        ],

        warpStart: 1,
        weftStart: 1,
        warpThreads: 12,
        weftThreads: 12,

        setup: {
            showAxes: false,
            bgColor: "white"
        },

        structureDimensions: {
            x: 0,
            y: 0,
            z: 0
        },

        threadDisplacement: {
            x: 0, // End to End Distance
            y: 0, // Layer Spacing
            z: 0 // Pick to Pick Distance
        },

        frustumSize: 7,

        weave2D8: [],

        warpRadius: 0,
        warpRadiusX: 0,
        warpRadiusY: 0,
        weftRadius: 0,
        weftRadiusX: 0,
        weftRadiusY: 0,

        maxFabricThickness: 0,

        defaultOpacity: 0,
        defaultDepthTest: true,

        axes: undefined,
        rotationAxisLine: undefined,

        mouseAnimate: false,

        // Three
        params: {

            animate: false,

            initCameraUp: new THREE.Vector3(0, 1, 0),
            initCameraPos: new THREE.Vector3(0, 6, 0),
            cameraPos: new THREE.Vector3(0, 6, 0),
            initControlsTarget: new THREE.Vector3(0, 0, 0),
            controlsTarget: new THREE.Vector3(0, 0, 0),
            initFabricRotation: new THREE.Vector3(0, 0, 0),
            fabricRotation: new THREE.Vector3(0, 0, 0),

            structure: [

                ["select", "Yarn Configs", "yarnConfig", [
                    ["biset", "Bi-Set"],
                    ["palette", "Palette"]
                ], {
                    col: "2/5"
                }],

                ["select", "Warp", "warpYarnId", [ ["system_0", "Default"] ], { col: "2/3", hide: true }],
                ["select", "Weft", "weftYarnId", [ ["system_0", "Default"] ], { col: "2/3", hide: true }],

                ["section", "Thread Density"],
                ["number", "Warp Density", "warpDensity", 55, {
                    col: "1/3",
                    min: 1,
                    max: 1000,
                    precision: 2
                }],
                ["number", "Weft Density", "weftDensity", 55, {
                    col: "1/3",
                    min: 1,
                    max: 1000,
                    precision: 2
                }],

                ["section", "Fabric Layers"],
                ["check", "Layer Structure", "layerStructure", 0],
                ["text", false, "layerStructurePattern", 1, {
                    col: "1/1",
                    hide: true
                }],
                ["number", "Layer Distance (mm)", "layerDistance", 10, {
                    col: "1/3",
                    min: 0,
                    max: 1000,
                    hide: true
                }],

                ["control", "save", "play"]

            ],

            render: [

                ["header", "Render Area"],
                ["number", "Warp Start", "warpStart", 1, {
                    col: "1/3"
                }],
                ["number", "Weft Start", "weftStart", 1, {
                    col: "1/3"
                }],
                ["number", "Warp Threads", "warpThreads", 4, {
                    col: "1/3",
                    min: 2,
                    max: 120
                }],
                ["number", "Weft Threads", "weftThreads", 4, {
                    col: "1/3",
                    min: 2,
                    max: 120
                }],

                ["header", "Render Quality"],
                ["number", "Radius Segments", "radialSegments", 8, {
                    col: "1/3",
                    min: 3,
                    max: 36
                }],
                ["number", "Tubular Segments", "tubularSegments", 8, {
                    col: "1/3",
                    min: 1,
                    max: 36
                }],
                ["check", "Show Curve Nodes", "showCurveNodes", 0, {
                    col: "1/3"
                }],
                ["check", "Show Wireframe", "showWireframe", 0, {
                    col: "1/3"
                }],
                ["check", "Smooth Shading", "smoothShading", 1, {
                    col: "1/3"
                }],
                ["check", "End Caps", "endCaps", 1, {
                    col: "1/3"
                }],

                ["control", "save", "play"]

            ],

            filters: [

                ["check", "Hide Colors", "hideColors", 0, {
                    col: "1/3"
                }],
                ["text", false, "hiddenColors", "", {
                    col: "1/1",
                    hide: true
                }],
                ["control", "save", "play"]

            ],

            scene: [

                ["select", "Projection", "projection", [
                    ["perspective", "PERSP"],
                    ["orthographic", "ORTHO"]
                ], {
                    col: "1/2"
                }],
                ["select", "Background", "bgType", [
                    ["solid", "Solid"],
                    ["gradient", "Gradient"],
                    ["transparent", "Transparent"],
                    ["image", "Image"]
                ], {
                    col: "1/2"
                }],
                ["color", "Background Color", "bgColor", "#FFFFFF", {
                    col: "1/3"
                }],
                ["check", "Show Axes", "showAxes", 0, {
                    col: "1/3"
                }],
                ["check", "Hover Outline", "mouseHoverOutline", 0, {
                    col: "1/3"
                }],
                ["check", "Hover Highlight", "mouseHoverHighlight", 0, {
                    col: "1/3"
                }],
                ["range", "Light Temperature", "lightTemperature", 6600, {
                    col: "1/1",
                    min: 2700,
                    max: 7500,
                    step: 100
                }],
                ["range", "Light Intensity", "lightsIntensity", 0.5, {
                    col: "1/1",
                    min: 0,
                    max: 1,
                    step: 0.05
                }],
                ["check", "Cast Shadow", "castShadow", 1, {
                    col: "1/3"
                }],
                ["control"]

            ]

        },

        exportGLTF: function() {

            var loadingbar = new Loadingbar("exportGLTF", "Exporting 3D Model", false);
            globalThree.resetPosition(function() {
                tp.showAxes = false;
                globalThree.axes.visible = false;
                globalThree.render();

                var options = {
                    trs: false,
                    onlyVisible: true,
                    truncateDrawRange: false,
                    binary: false,
                    forceIndices: false,
                    forcePowerOfTwoTextures: false
                };
                var exporter = new THREE.GLTFExporter();
                exporter.parse(globalThree.fabric, function(gltf) {
                    if (gltf instanceof ArrayBuffer) {
                        saveArrayBufferAsFile(gltf, "scene.glb");
                    } else {
                        var output = JSON.stringify(gltf, null, 2);
                        saveStringAsFile(output, "weave3d.gltf");
                    }
                    loadingbar.remove();
                }, options);
            });

        },

        applyShadowSetting: function() {

            let _this = this;

            q.three.createScene(function() {
                _this.lights.directional0.castShadow = tp.castShadow;
                var threads = _this.fabric.children;
                for (var i = threads.length - 1; i >= 0; --i) {
                    if (threads[i].name == "thread") {
                        threads[i].castShadow = tp.castShadow;
                        threads[i].receiveShadow = tp.castShadow;
                    }
                }
                _this.render();
            });

        },

        resetPosition: function(callback) {

            this.currentPreset = 0;
            this.animateThreeSceneTo(this.modelParams.initRotation, tp.initCameraPos, tp.initControlsTarget, callback);

        },

        changeView: function(index = false) {

            if (!index) {
                index = loopNumber(this.currentPreset + 1, this.rotationPresets.length);
            }
            this.currentPreset = index;
            var pos = this.rotationPresets[index];
            var modelRotation = new THREE.Vector3(toRadians(pos[0]), toRadians(pos[1]), toRadians(pos[2]));
            globalThree.animateThreeSceneTo(modelRotation);

        },

        // q.three.setInterface:
        setInterface: async function(instanceId = 0, render = true) {

            // console.log(["globalThree.setInterface", instanceId]);
            //logTime("globalThree.setInterface("+instanceId+")");

            var threeBoxL = 0;
            var threeBoxB = 0;

            var threeBoxW = app.frame.width - threeBoxL;
            var threeBoxH = app.frame.height - threeBoxB;

            $("#three-container").css({
                "width": threeBoxW,
                "height": threeBoxH,
                "left": threeBoxL,
                "bottom": threeBoxB,
            });

            q.position.update("three");

            if (app.views.active !== "three" || !render) return;

            await q.three.createScene();

            globalThree.perspectiveCamera.aspect = app.frame.width / app.frame.height;
            var aspect = app.frame.width / app.frame.height;
            var frustumSize = globalThree.frustumSize;
            globalThree.orthographicCamera.left = frustumSize * aspect / -2;
            globalThree.orthographicCamera.right = frustumSize * aspect / 2;
            globalThree.orthographicCamera.top = frustumSize / 2;
            globalThree.orthographicCamera.bottom = frustumSize / -2;

            globalThree.renderer.setSize(app.frame.width, app.frame.height);
            globalThree.perspectiveCamera.updateProjectionMatrix();
            globalThree.orthographicCamera.updateProjectionMatrix();
            globalThree.composer.setSize(app.frame.width, app.frame.height);
            globalThree.setBackground();
            globalThree.render();

            //logTimeEnd("globalThree.setInterface("+instanceId+")");

        },

        setBackground: async function() {
            if (!this.composer) return;
            await setSceneBackground(this.renderer, this.scene, "#three-container", tp.bgType, tp.bgColor);
            q.three.render();
        },

        // q.three.createScene:
        createScene: function(callback = false) {

            return new Promise((resolve, reject) => {

                if (this.status.scene) return resolve();

                let _this = globalThree;

                _this.renderer = new THREE.WebGLRenderer({
                    antialias: true,
                    alpha: true,
                    preserveDrawingBuffer: true
                });

                _this.renderer.setPixelRatio(q.pixelRatio);
                _this.renderer.setSize(app.frame.width, app.frame.height);

                _this.renderer.physicallyCorrectLights = true;
                _this.renderer.shadowMap.enabled = true;
                _this.renderer.shadowMapSoft = true;
                _this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                _this.renderer.shadowMap.bias = 0.0001;

                _this.renderer.outputEncoding = THREE.sRGBEncoding;

                Debug.item("maxAnisotropy", _this.maxAnisotropy, "three");
                Debug.item("maxTextureSize", _this.renderer.capabilities.maxTextureSize, "three");

                var container = document.getElementById("three-container");
                container.innerHTML = "";
                container.appendChild(_this.renderer.domElement);
                _this.renderer.domElement.id = "threeDisplay";
                $("#threeDisplay").addClass('graph-canvas');
                q.canvas.threeDisplay = _this.renderer.domElement;

                // scene
                _this.scene = new THREE.Scene();

                // cameras
                var aspect = app.frame.width / app.frame.height;
                var frustumSize = _this.frustumSize;
                _this.perspectiveCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 500);
                _this.orthographicCamera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, -200, 500);
                _this.camera = tp.projection == "perspective" ? _this.perspectiveCamera : _this.orthographicCamera;

                _this.scene.add(_this.camera);
                //_this.scene.add(new THREE.CameraHelper(_this.camera));

                // controls
                _this.controls = new THREE.OrbitControls(_this.camera, _this.renderer.domElement);
                _this.controls.minDistance = 1;
                _this.controls.maxDistance = 100;
                _this.controls.enableKeys = false;
                _this.controls.screenSpacePanning = true;

                //_this.controls.minPolarAngle = 0;
                //_this.controls.maxPolarAngle = Math.PI/1.8;

                // _this.controls.enableDamping = true;
                // _this.controls.dampingFactor = 0.05;
                // _this.controls.rotateSpeed = 0.1;

                // _this.controls.autoRotate = true;
                // _this.controls.autoRotateSpeed = 1;

                _this.camera.position.copy(tp.initCameraPos);
                _this.controls.target.copy(tp.initControlsTarget);
                _this.controls.update();

                _this.controls.addEventListener("change", function() {
                    _this.render();
                });

                _this.fabric = new THREE.Group();
                _this.scene.add(_this.fabric);
                var initRotation = _this.modelParams.initRotation;
                _this.fabric.rotation.set(initRotation.x, initRotation.y, initRotation.z);

                // Custom Axes
                _this.axes = new THREE.Group();
                var xArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 1, 0xFF0000);
                var yArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 1), new THREE.Vector3(0, 0, 0), 1, 0x00FF00);
                var zArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 0), 1, 0x0000FF);
                xArrow.name = "axes-arrow-x";
                yArrow.name = "axes-arrow-y";
                zArrow.name = "axes-arrow-z";
                _this.axes.add(xArrow);
                _this.axes.add(yArrow);
                _this.axes.add(zArrow);
                _this.axes.name = "axes";
                _this.fabric.add(_this.axes);
                _this.axes.visible = tp.showAxes;

                _this.setBackground();

                var line_material = new THREE.LineBasicMaterial({
                    color: 0x999999
                });
                var line_geometry = new THREE.Geometry();
                line_geometry.vertices.push(new THREE.Vector3(0, -10, 0));
                line_geometry.vertices.push(new THREE.Vector3(0, 0, 0));
                line_geometry.vertices.push(new THREE.Vector3(0, 10, 0));
                _this.rotationAxisLine = new THREE.Line(line_geometry, line_material);
                _this.scene.add(_this.rotationAxisLine);
                _this.rotationAxisLine.visible = tp.showAxes;

                _this.composerSetup();

                _this.setLights();

                _this.status.scene = true;
                _this.render();
                _this.startAnimation();
                resolve();

            });

        },

        // q.three.setLights;
        setLights: function() {

            let _this = this;
            var _lights = _this.lights;

            var kelvin = tp.lightTemperature;
            var lh_rgb = kelvinToRGB(kelvin);
            var lh = rgb_hex(lh_rgb.r, lh_rgb.g, lh_rgb.b, "0x");

            Debug.item("lightTemperatureHEX", lh_rgb.r + "," + lh_rgb.g + "," + lh_rgb.b, "three");

            lh = parseInt(lh, 16);

            var li = tp.lightsIntensity;

            var ai = 4 * li;
            var pi = 30 * li;
            var si = 300 * li;
            var fi = 150 * li;
            var hi = 3 * li;
            var di = 3 * li;

            if (!_lights.ambient) {
                _lights.ambient = new THREE.AmbientLight(lh, ai);
                this.scene.add(_lights.ambient);
            } else {
                _lights.ambient.intensity = ai;
                _lights.ambient.color.setHex(lh);
            }

            if (!_lights.directional0) {

                _lights.directional0 = new THREE.DirectionalLight(lh, di);
                _lights.directional0.position.set(-10, 10, -10);
                this.scene.add(_lights.directional0);

                _lights.directional0.shadow.bias = -0.0001;
                _lights.directional0.shadow.mapSize.width = 512;
                _lights.directional0.shadow.mapSize.height = 512;
                _lights.directional0.shadow.camera.near = 0.5;
                _lights.directional0.shadow.camera.far = 100;

                _lights.directional1 = new THREE.DirectionalLight(lh, di);
                _lights.directional1.position.set(10, -10, 10);
                this.scene.add(_lights.directional1);

            } else {
                _lights.directional0.intensity = di;
                _lights.directional0.color.setHex(lh);

                _lights.directional1.intensity = di;
                _lights.directional1.color.setHex(lh);
            }

            _this.lights.directional0.castShadow = tp.castShadow;

            q.three.render();

        },

        composerSetup: function() {
            globalThree.composer = new THREE.EffectComposer(globalThree.renderer);
            globalThree.renderPass = new THREE.RenderPass(globalThree.scene, globalThree.camera);
            globalThree.composer.addPass(globalThree.renderPass);

            this.outlinePass.setup();

            globalThree.effectFXAA = new THREE.ShaderPass(THREE.FXAAShader);
            globalThree.effectFXAA.uniforms.resolution.value.set(1 / app.frame.width, 1 / app.frame.height);
            globalThree.composer.addPass(globalThree.effectFXAA);

        },

        swithCameraTo: function(projection) {

            var currentCamera = this.camera.isPerspectiveCamera ? "perspective" : this.camera.isOrthographicCamera ? "orthographic" : "unknown";
            if (projection !== currentCamera) {

                var cameraZoom = this.camera.zoom;
                var cameraPos = this.camera.position.clone();
                var cameraRotation = this.camera.rotation.clone();

                var cameraMatrix = this.camera.matrix.clone();
                var controlsTarget = this.controls.target.clone();
                var controlsPos = this.controls.position0.clone();
                var quaternion = this.camera.quaternion.clone();

                this.camera = projection == "orthographic" ? this.orthographicCamera : this.perspectiveCamera;

                globalThree.composerSetup();
                this.controls.object = this.camera;
                this.controls.target.copy(controlsTarget);
                this.camera.position.copy(cameraPos);
                this.camera.rotation.copy(cameraRotation);
                this.camera.matrix.copy(cameraMatrix);
                this.camera.quaternion.copy(quaternion);
                this.camera.updateProjectionMatrix();

                if (projection == "orthographic") {
                    var objectPos = new THREE.Vector3(0, 0, 0);
                    var distance = this.camera.position.distanceTo(objectPos);
                    this.orthographicCamera.zoom = 9 / distance;
                    this.orthographicCamera.updateProjectionMatrix();
                }

                if (projection == "perspective") {
                    this.perspectiveCamera.position.normalize().multiplyScalar(9 / this.orthographicCamera.zoom);
                    this.perspectiveCamera.updateProjectionMatrix();
                }

                this.controls.update();
                q.three.render();
            }

        },

        disposeHierarchy: function(node, callback) {
            for (var i = node.children.length - 1; i >= 0; i--) {
                var child = node.children[i];
                this.disposeHierarchy(child, callback);
                callback(child);
            }
        },

        disposeNode: function(parentObject) {
            parentObject.traverse(function(node) {
                if (node instanceof THREE.Mesh) {
                    if (node.geometry) {
                        node.geometry.dispose();
                    }
                    if (node.material) {
                        var materialArray;
                        if (node.material instanceof THREE.MeshFaceMaterial || node.material instanceof THREE.MultiMaterial) {
                            materialArray = node.material.materials;
                        } else if (node.material instanceof Array) {
                            materialArray = node.material;
                        }
                        if (materialArray) {
                            materialArray.forEach(function(mtrl, idx) {
                                if (mtrl.map) mtrl.map.dispose();
                                if (mtrl.lightMap) mtrl.lightMap.dispose();
                                if (mtrl.bumpMap) mtrl.bumpMap.dispose();
                                if (mtrl.normalMap) mtrl.normalMap.dispose();
                                if (mtrl.specularMap) mtrl.specularMap.dispose();
                                if (mtrl.envMap) mtrl.envMap.dispose();
                                mtrl.dispose();
                            });
                        } else {
                            if (node.material.map) node.material.map.dispose();
                            if (node.material.lightMap) node.material.lightMap.dispose();
                            if (node.material.bumpMap) node.material.bumpMap.dispose();
                            if (node.material.normalMap) node.material.normalMap.dispose();
                            if (node.material.specularMap) node.material.specularMap.dispose();
                            if (node.material.envMap) node.material.envMap.dispose();
                            node.material.dispose();
                        }
                    }
                }
            });
        },

        disposeScene: function() {

            this.disposeHierarchy(this.scene, this.disposeNode);
            this.renderer.dispose();
            this.renderer.forceContextLoss();
            //this.renderer.context = undefined;
            this.renderer.domElement = undefined;
            this.status.scene = false;

        },

        disposeMaterials: function() {
            let _this = this;
            ["warp", "weft"].forEach(function(set) {
                for (let c in _this.materials[set]) {
                    if ( _this.materials[set].hasOwnProperty(c) ){
                        _this.materials[set][c].dispose();
                        _this.materials[set][c] = undefined;
                    }
                }
                _this.materials[set] = [];
            });
        },

        // Three
        loadTextures: function (callback) {

            let _this = this;

            if ( _this.textures.needsUpdate ) {

                var loadingbar = new Loadingbar("threeloadingtextures", "Loading Textures");
                var loader = new THREE.TextureLoader();

                for (let id in _this.textures) {

                    if ( _this.textures[id].url ) {

                        _this.textures.pending++;

                        _this.textures[id].val = loader.load(_this.textures[id].url, function (texture) {

                            texture.wrapS = THREE.RepeatWrapping;
                            texture.wrapT = THREE.RepeatWrapping;
                            texture.rotation = toRadians(45);
                            texture.repeat.set(1, 1);
                            texture.offset.set(0, 0);
                            texture.anisotropy = _this.renderer.capabilities.getMaxAnisotropy();
                            texture.needsUpdate = true;

                            _this.render();

                            _this.textures.pending--;

                            if ( !_this.textures.pending ) {

                                loadingbar.remove();
                                _this.textures.needsUpdate = false;

                                Debug.input("number", "Texture Rotation Deg", 45, "live", function (val) {
                                    globalThree.materials.weft.b.bumpMap.rotation = toRadians(Number(val));
                                    _this.render();
                                });

                                Debug.input("text", "Texture Repeat 'x,y'", "1,1", "live", function (val) {
                                    val = val.split(",");
                                    let val0 = Number(val[0]);
                                    let val1 = Number(val[1]);
                                    globalThree.materials.weft.b.bumpMap.repeat.set(val[0], val[1]);
                                    _this.render();
                                });

                                Debug.input("text", "Texture Offset 'x,y'", "0,0", "live", function (val) {
                                    val = val.split(",");
                                    let val0 = Number(val[0]);
                                    let val1 = Number(val[1]);
                                    globalThree.materials.weft.baseCanvas.bumpMap.offset.set(val[0], val[1]);
                                    _this.render();
                                });

                                if (typeof callback === "function") callback();

                            }

                        });

                    }

                }

            } else {

                if (typeof callback === "function") callback();

            }

        },

        // Three
        createThreadMaterials: function(callback) {

            return new Promise((resolve, reject) => {

                var bumpMap, color, threadLength, threadDia, renderSize;
                let _this = this;

                _this.loadTextures(function() {

                    var loadingbar = new Loadingbar("threecreatingmaterials", "Creating Materials");

                    if (!_this.status.materials) {

                        _this.disposeMaterials();

                        ["warp", "weft"].forEach(function(set) {

                            q.pattern.colors(set).forEach(function(colorCode, i) {

                                color = q.palette.colors[colorCode];

                                _this.materials[set][colorCode] = new THREE.MeshStandardMaterial({
                                    color: color.hex,
                                    side: THREE.FrontSide,
                                    roughness: 1,
                                    metalness: 0,
                                    transparent: true,
                                    opacity: _this.defaultOpacity,
                                    depthWrite: true,
                                    wireframe: tp.showWireframe,
                                    name: set + "-" + colorCode
                                });

                                threadLength = tp[set + "Threads"] / tp[set + "Density"];

                                let yarnId = tp.yarnConfig == "palette" ? color.yarnId : tp[set+"YarnId"];
                                let yarn = q.graph.yarns[yarnId] !== undefined ? q.graph.yarns[yarnId] : q.graph.yarns.system_0;
                                let yarnThickness = Textile.getYarnDia(yarn.number, yarn.number_system, "px", "in");
                                let isSpun = yarn.structure == "spun";

                                if (isSpun) {
                                    bumpMap = _this.textures.threadBumpMap.val.clone();
                                    bumpMap.offset.set(getRandom(0, 1), getRandom(0, 1));
                                    bumpMap.repeat.set(threadLength / yarnThickness / 5, 1);
                                    bumpMap.needsUpdate = true;
                                    _this.materials[set][colorCode].bumpMap = bumpMap;
                                    _this.materials[set][colorCode].bumpScale = 0.01;
                                }

                            });

                        });

                    }

                    loadingbar.remove();

                    _this.render();

                    resolve();

                });

            });

        },

        buildFabric: async function() {

            let _this = this;

            await q.three.createScene();
            q.three.removeFabric();
            await q.three.createThreadMaterials();

            let yarnConfig = tp.yarnConfig;
            let warpProfile = tp.warpYarnProfile;
            let weftProfile = tp.weftYarnProfile;
            let warpNumber = tp.warpNumber;
            let weftNumber = tp.weftNumber;
            let warpAspect = tp.warpAspect;
            let weftAspect = tp.weftAspect;
            let warpNumberSystem = "nec";
            let weftNumberSystem = "nec";

            let warpDensity = tp.warpDensity;
            let weftDensity = tp.weftDensity;
            let radialSegments = tp.radialSegments;
            let warpStart = tp.warpStart;
            let weftStart = tp.weftStart;
            let warpThreads = tp.warpThreads;
            let weftThreads = tp.weftThreads;
            let showCurveNodes = tp.showCurveNodes;
            let showWireframe = tp.showWireframe;

            if (!q.graph.weave2D8.is2D8) return;

            let weave2D8 = q.graph.weave2D8.tileFill(warpThreads, weftThreads, 1 - warpStart, 1 - weftStart);
            _this.weave2D8 = weave2D8;

            _this.defaultOpacity = tp.showCurveNodes ? 0.25 : 1;
            _this.defaultDepthTest = tp.showCurveNodes ? false : true;

            // Thread to Thread Distance in mm
            let threadDisplacement = {
                x: 25.4 / warpDensity,
                z: 25.4 / weftDensity
            };
            _this.threadDisplacement = threadDisplacement;

            // Structure Dimensions
            let structureDimension = {
                x: threadDisplacement.x * (warpThreads - 1),
                z: threadDisplacement.z * (weftThreads - 1)
            };
            _this.structureDimension = structureDimension;

            // Offset model to center
            let xOffset = threadDisplacement.x * (warpThreads - 1) / 2;
            let zOffset = threadDisplacement.z * (weftThreads - 1) / 2;

            _this.xOffset = xOffset;
            _this.zOffset = zOffset;

            let [warpRadius, warpRadiusX, warpRadiusY] = Textile.getYarnRadius(warpNumber, warpNumberSystem, warpProfile, warpAspect);
            _this.warpRadius = warpRadius;

            let [weftRadius, weftRadiusX, weftRadiusY] = Textile.getYarnRadius(weftNumber, weftNumberSystem, weftProfile, weftAspect);
            _this.weftRadius = weftRadius;

            let maxFabricThickness = (warpRadiusY + weftRadiusY) * 2;

            _this.warpRadiusX = warpRadiusX;
            _this.warpRadiusY = warpRadiusY;
            _this.weftRadiusX = weftRadiusX;
            _this.weftRadiusY = weftRadiusY;
            _this.maxFabricThickness = maxFabricThickness;

            // Arrow Axes Position
            let axesPos = {
                x: -(structureDimension.x / 2 + threadDisplacement.x + Math.min(threadDisplacement.x, threadDisplacement.z) / 2),
                y: 0,
                z: structureDimension.z / 2 + threadDisplacement.z + Math.min(threadDisplacement.x, threadDisplacement.z) / 2
            };
            _this.axes.position.set(axesPos.x, axesPos.y, axesPos.z);
            _this.axes.visible = tp.showAxes;
            _this.rotationAxisLine.visible = tp.showAxes;

            _this.threads = [];

            let percentPerThread = 100 / (tp.warpThreads + tp.weftThreads);
            let x = 0;
            let xThreads = tp.warpThreads;
            let y = 0;
            let yThreads = tp.weftThreads;
            let loadingbar = new Loadingbar("addThreads", "Rendering Threads", true);
            $.doTimeout("addThreads", 1, function() {
                if (x < xThreads) {
                    loadingbar.title = "Rendering Warp Thread " + (x + 1) + "/" + xThreads;
                    _this.addThread("warp", x);
                    _this.render();
                    loadingbar.progress = Math.round((x + y) * percentPerThread);
                    x++;
                    return true;
                }
                if (x == xThreads && y < yThreads) {
                    loadingbar.title = "Rendering Weft Thread " + (y + 1) + "/" + yThreads;
                    _this.addThread("weft", y);
                    _this.render();
                    loadingbar.progress = Math.round((x + y) * percentPerThread);
                    y++;
                    return true;
                }
                if (x == xThreads && y == yThreads) {
                    _this.render();
                    loadingbar.remove();
                    _this.afterBuildFabric();
                    return false;
                }
            });

        },

        afterBuildFabric: function() {

            let _this = this;

            _this.threads.forEach(function(thread, i) {
                thread.material.opacity = _this.defaultOpacity;
                thread.material.depthTest = _this.defaultDepthTest;
            });

            _this.timeline = new TimelineLite({
                delay: 0,
                autoRemoveChildren: true,
                smoothChildTiming: true,
                onStart: function() {
                    _this.controls.enabled = false;
                    _this.animate = true;
                    Debug.item("Timeline.Status", "start", "three");
                },
                onUpdate: function() {
                    _this.camera.updateProjectionMatrix();
                    Debug.item("Timeline.Status", "updating", "three");
                },
                onComplete: function(callback) {
                    _this.controls.enabled = true;
                    _this.animate = false;
                    Debug.item("Timeline.Status", "complete", "three");
                    if (typeof callback === "function") callback();
                }
            });

            // debug Console
            Debug.item("Geometries", _this.renderer.info.memory.geometries, "three");
            Debug.item("Textures", _this.renderer.info.memory.textures, "three");
            Debug.item("Calls", _this.renderer.info.render.calls, "three");
            Debug.item("Triangles", _this.renderer.info.render.triangles, "three");
            Debug.item("Points", _this.renderer.info.render.points, "three");
            Debug.item("Lines", _this.renderer.info.render.lines, "three");

            _this.render();

        },

        addThread: function(set, threeIndex) {

            // console.log("addThread : " + set + "-" + threeIndex);

            let _this = this;

            let sx, sy, sz, waveLength, waveAmplitude, pathSegments, intersectH, orientation, yarnRadiusX, yarnRadiusY;
            let weaveIndex, patternIndex;

            let threadDisplacement = _this.threadDisplacement;
            let xOffset = _this.structureDimension.x / 2;
            let zOffset = _this.structureDimension.z / 2;
            let hft = _this.maxFabricThickness / 2; // half fabric thickness

            let radialSegments = tp.radialSegments;

            let WpRx = _this.warpRadiusX;
            let WpRy = _this.warpRadiusY;
            let WfRx = _this.weftRadiusX;
            let WfRy = _this.weftRadiusY;
            let rigidityVar = (WfRy * Math.sqrt(WfRy * WfRx) * threadDisplacement.z * threadDisplacement.z) / (WpRy * Math.sqrt(WpRy * WpRx) * threadDisplacement.z * threadDisplacement.z);
            let WpWa = hft * rigidityVar / (1 + rigidityVar); // Warp Wave Amplitude
            let WfWa = hft - WpWa; // Weft Wave Amplitude

            if (set == "warp") {

                orientation = "z";
                sx = threeIndex * threadDisplacement.x - xOffset;
                sy = 0;
                sz = zOffset;

                waveLength = threadDisplacement.z * 2;
                waveAmplitude = WpWa;
                pathSegments = (tp.weftThreads + 1) * tp.tubularSegments;

                weaveIndex = loopNumber(threeIndex + tp.warpStart - 1, q.graph.ends);
                patternIndex = loopNumber(threeIndex + tp.warpStart - 1, q.pattern.warp.length);

            } else if (set == "weft") {

                orientation = "x";
                sx = -xOffset;
                sy = 0;
                sz = -threeIndex * threadDisplacement.z + zOffset;

                waveLength = threadDisplacement.x * 2;
                waveAmplitude = WfWa;
                pathSegments = (tp.warpThreads + 1) * tp.tubularSegments;

                weaveIndex = loopNumber(threeIndex + tp.weftStart - 1, q.graph.picks);
                patternIndex = loopNumber(threeIndex + tp.weftStart - 1, q.pattern.weft.length);

            }

            // console.log([set, patternIndex]);

            let threadUpDownArray = getThreadUpDownArray(_this.weave2D8, set, threeIndex);
            let colorCode = q.pattern[set][patternIndex] || false;
            let color = q.palette.colors[colorCode];
            let colorHex = colorCode ? color.hex : (set == "warp" ? "#0000FF" : "#FFFFFF");

            let yarnId = tp.yarnConfig == "palette" ? color.yarnId : tp[set+"YarnId"];
            let yarn = q.graph.yarns[yarnId] !== undefined ? q.graph.yarns[yarnId] : q.graph.yarns.system_0;

            let [radius, xRadius, yRadius] = Textile.getYarnRadius(yarn.number, yarn.number_system, yarn.profile, yarn.aspect);

            let userData = {
                type: "tube",
                threadSet: set,
                weavei: weaveIndex,
                patterni: patternIndex,
                threei: threeIndex,
                colorCode: colorCode,
                threeId: set + "-" + threeIndex,
                weaveId: set + "-" + weaveIndex
            };

            // console.log(userData);
            let hiddenColors = tp.hiddenColors.split("");
            if (tp.hideColors && hiddenColors.includes(colorCode)) {
                return;
            }

            return _this.add3DWave(sx, sy, sz, xRadius, yRadius, waveLength, waveAmplitude, threadUpDownArray, orientation, colorHex, userData, pathSegments, radialSegments, yarn.profile);

        },

        add3DWave: function(sx, sy, sz, xTubeRadius, yTubeRadius, waveLength, waveAmplitude, threadUpDownArray, orientation, hex, userData, pathSegments, radialSegments, shapeProfile) {

            //console.log(["add3DWave", userData.threadSet]);

            let _this = this;

            var segmentY;

            // var wa = waveAmplitude;

            var wa = yTubeRadius;

            var wl = -waveLength;
            var bca = wl / 4; //bezierControlAmount

            // var atan = Math.atan2(wa*2, wl/2) / Math.PI * 2;
            // var bca =  (atan * wl + atan * wa) / 1.5;

            var state, prevState, n, nx, ny, nz, curvePoints, threadMaterial, geometry;

            var threadSet = userData.threadSet;
            var colorCode = userData.colorCode;
            var isWarp = threadSet == "warp";
            var isWeft = threadSet == "weft";
            var pointCount = tp.tubularSegments;

            var points = [];

            if (isWarp) {

                for (n = 0; n < threadUpDownArray.length; n++) {
                    state = threadUpDownArray[n];
                    if (n) {
                        nz = sz + (n - 1) * wl / 2;
                        if (n == 1) {
                            ny = prevState ? wa : -wa;
                            curvePoints = waveSegmentPoints("z", sx, ny, sz - wl / 2, wl / 2, 0, bca, pointCount, prevState);
                            points = points.concat(curvePoints);
                        }
                        if (state == prevState) {
                            ny = state ? wa : -wa;
                            curvePoints = waveSegmentPoints("z", sx, ny, nz, wl / 2, 0, bca, pointCount, state);
                        } else {
                            curvePoints = waveSegmentPoints("z", sx, sy, nz, wl / 2, wa * 2, bca, pointCount, prevState);
                        }
                        points = points.concat(curvePoints);
                        if (n == threadUpDownArray.length - 1) {
                            ny = state ? wa : -wa;
                            curvePoints = waveSegmentPoints("z", sx, ny, nz + wl / 2, wl / 2, 0, bca, pointCount, state, false);
                            points = points.concat(curvePoints);
                        }
                    }
                    prevState = state;
                }

            } else if (isWeft) {

                for (n = 0; n < threadUpDownArray.length; n++) {
                    state = threadUpDownArray[n];
                    if (n) {
                        nx = sx - (n - 1) * wl / 2;
                        if (n == 1) {
                            ny = prevState ? wa : -wa;
                            curvePoints = waveSegmentPoints("x", sx + wl / 2, ny, sz, wl / 2, 0, bca, pointCount, prevState);
                            points = points.concat(curvePoints);
                        }
                        if (state == prevState) {
                            ny = state ? wa : -wa;
                            curvePoints = waveSegmentPoints("x", nx, ny, sz, wl / 2, 0, bca, pointCount, state);
                        } else {
                            curvePoints = waveSegmentPoints("x", nx, sy, sz, wl / 2, wa * 2, bca, pointCount, prevState);
                        }
                        points = points.concat(curvePoints);
                        if (n == threadUpDownArray.length - 1) {
                            ny = state ? wa : -wa;
                            curvePoints = waveSegmentPoints("x", nx - wl / 2, ny, sz, wl / 2, 0, bca, pointCount, state, false);
                            points = points.concat(curvePoints);
                        }
                    }
                    prevState = state;
                }

            }

            var path = new THREE.CatmullRomCurve3(points);

            let threadShape, extrudeSettings;

            if (shapeProfile == "elliptical") {

                let shapeRotation = isWarp ? 0.5 * Math.PI : 0;
                let shape = new THREE.EllipseCurve(0, 0, xTubeRadius, yTubeRadius, 0, 2 * Math.PI, false, shapeRotation);
                threadShape = new THREE.Shape(shape.getPoints(tp.radialSegments));
                extrudeSettings = {
                    steps: pathSegments,
                    extrudePath: path
                };

            } else if (shapeProfile == "rectangular") {

                var shapePoints = [];
                var shapeW = xTubeRadius;
                var shapeH = yTubeRadius;
                if (isWarp) {
                    [shapeW, shapeH] = [shapeH, shapeW];
                }
                shapePoints.push(new THREE.Vector2(shapeW, -shapeH));
                shapePoints.push(new THREE.Vector2(shapeW, shapeH));
                shapePoints.push(new THREE.Vector2(-shapeW, shapeH));
                shapePoints.push(new THREE.Vector2(-shapeW, -shapeH));

                threadShape = new THREE.Shape(shapePoints);
                extrudeSettings = {
                    steps: pathSegments,
                    extrudePath: path
                };

            } else if (shapeProfile == "lenticular") {

                var shapePartA, shapePartB;
                var startPiA = 1 / 6 * Math.PI;
                var endPiA = 5 / 6 * Math.PI;
                var startPiB = 7 / 6 * Math.PI;
                var endPiB = 11 / 6 * Math.PI;
                if (isWarp) {
                    shapePartA = new THREE.EllipseCurve(yTubeRadius, 0, xTubeRadius / Math.sqrt(3) * 2, yTubeRadius * 2, startPiA, endPiA, false, 0.5 * Math.PI);
                    shapePartB = new THREE.EllipseCurve(-yTubeRadius, 0, xTubeRadius / Math.sqrt(3) * 2, yTubeRadius * 2, startPiB, endPiB, false, 0.5 * Math.PI);
                } else if (isWeft) {
                    shapePartA = new THREE.EllipseCurve(0, -yTubeRadius, xTubeRadius / Math.sqrt(3) * 2, yTubeRadius * 2, startPiA, endPiA, false, 0);
                    shapePartB = new THREE.EllipseCurve(0, yTubeRadius, xTubeRadius / Math.sqrt(3) * 2, yTubeRadius * 2, startPiB, endPiB, false, 0);
                }
                var shapePointsA = shapePartA.getPoints(Math.ceil(tp.radialSegments / 2));
                var shapePointsB = shapePartB.getPoints(Math.ceil(tp.radialSegments / 2));
                shapePointsB.shift();
                shapePointsB.pop();
                shapePointsA.push(...shapePointsB);
                threadShape = new THREE.Shape(shapePointsA);
                extrudeSettings = {
                    steps: pathSegments,
                    extrudePath: path
                };

            } else if (shapeProfile == "circular") {

                if (tp.endCaps) {

                    geometry = new THREE.TubeGeometry(path, pathSegments, xTubeRadius, radialSegments, false);

                    var i, p0, p1, p2, uv0, uv1, uv2, face;

                    var normal = new THREE.Vector3(0, 1, 0);
                    var materialIndex = 0;

                    var startShape = new THREE.Geometry();
                    startShape.vertices.push(path.points[0]);
                    startShape.vertices.push(...geometry.vertices.slice(0, radialSegments));

                    var endShape = new THREE.Geometry();
                    endShape.vertices.push(path.points[path.points.length - 1]);
                    endShape.vertices.push(...geometry.vertices.slice(-radialSegments).reverse());

                    [startShape, endShape].forEach(function(v, i) {
                        for (i = 0; i < radialSegments; i++) {
                            p0 = 0;
                            p1 = i + 1;
                            p2 = p1 == radialSegments ? 1 : i + 2;
                            face = new THREE.Face3(p0, p1, p2, normal, null, materialIndex);
                            v.faces.push(face);
                            uv0 = new THREE.Vector2();
                            uv1 = new THREE.Vector2();
                            uv2 = new THREE.Vector2();
                            v.faceVertexUvs[0].push([uv0, uv1, uv2]);
                        }
                        v.verticesNeedUpdate = true;
                        v.elementsNeedUpdate = true;
                        v.computeBoundingSphere();
                        geometry.merge(v);
                    });

                    geometry.mergeVertices();
                    geometry = new THREE.BufferGeometry().fromGeometry(geometry);

                } else {

                    geometry = new THREE.TubeBufferGeometry(path, pathSegments, xTubeRadius, radialSegments, false);

                }

            }

            if (shapeProfile !== "circular") {

                if (tp.smoothShading) {
                    geometry = new THREE.ExtrudeGeometry(threadShape, extrudeSettings);
                    geometry.mergeVertices();
                    geometry.computeVertexNormals();
                    geometry = new THREE.BufferGeometry().fromGeometry(geometry);
                } else {
                    geometry = new THREE.ExtrudeBufferGeometry(threadShape, extrudeSettings);
                }

            }

            // console.log([threadSet, colorCode]);
            // console.log(_this.materials);

            threadMaterial = _this.materials[threadSet][colorCode];
            threadMaterial.flatShading = !tp.smoothShading;

            var thread = new THREE.Mesh(geometry, threadMaterial);

            thread.name = "thread";

            if (tp.showCurveNodes) {

                var pathPoints = path.points;
                var nodePointGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
                var nodePointMaterial = new THREE.PointsMaterial({
                    color: hex,
                    size: 0.04
                });
                var nodePoints = new THREE.Points(nodePointGeometry, nodePointMaterial);
                nodePoints.userData = {
                    type: "points",
                    threadSet: threadSet,
                    weavei: userData.weavei,
                    threei: userData.threei,
                    colorCode: userData.colorCode,
                    threeId: userData.threeId,
                    weaveId: userData.weaveId
                };
                nodePoints.name = "points";
                this.fabric.add(nodePoints);
                _this.childIds.push(nodePoints.id);

                var geometry_line = new THREE.BufferGeometry().setFromPoints(pathPoints);
                var material_line = new THREE.LineBasicMaterial({
                    color: hex
                });
                var line = new THREE.Line(geometry_line, material_line);
                line.userData = {
                    type: "line",
                    threadSet: threadSet,
                    weavei: userData.weavei,
                    threei: userData.threei,
                    colorCode: userData.colorCode,
                    threeId: userData.threeId,
                    weaveId: userData.weaveId
                };
                line.name = "line";
                this.fabric.add(line);
                _this.childIds.push(line.id);

            }

            thread.castShadow = tp.castShadow;
            thread.receiveShadow = tp.castShadow;

            thread.userData = {
                type: "tube",
                threadSet: threadSet,
                weavei: userData.weavei,
                threei: userData.threei,
                colorCode: userData.colorCode,
                threeId: userData.threeId,
                weaveId: userData.weaveId
            };

            _this.fabric.add(thread);
            _this.threads.push(thread);
            _this.childIds.push(thread.id);

            return thread.id;

            //_this.render();

        },

        removeThread: function(threadSet, threeIndex) {
            let _this = this;
            var threads = _this.fabric.children;
            var threadId;
            for (var i = _this.fabric.children.length - 1; i >= 0; --i) {
                if (threads[i].userData.threadSet == threadSet && threads[i].userData.threei == threeIndex) {
                    _this.childIds = _this.childIds.removeItem(threads[i].id);
                    threadId = threads[i].id;
                    _this.disposeNode(threads[i]);
                    _this.fabric.remove(threads[i]);
                }
            }
            return threadId;
        },

        removeFabric: function() {
            var threads = this.fabric.children;
            for (var i = threads.length - 1; i >= 0; i--) {
                if (threads[i].name !== "axes") {
                    this.disposeNode(threads[i]);
                    this.fabric.remove(threads[i]);
                }
            }
            this.threads = [];
            this.childIds = [];
        },

        animateThreeSceneTo: function(modelRotation = false, cameraPos = false, controlsTarget = false, callback = false) {

            app.views.three.toolbar.disableItem("toolbar-three-change-view");

            var ez = Power4.easeInOut;
            var duration = 1.5;

            var t = this.timeline;
            var c = this.camera;

            var fr = this.fabric.rotation;
            var co = this.controls.target;

            var mr = modelRotation;
            var cp = cameraPos;
            var ct = controlsTarget;

            t.clear();

            if (modelRotation) {
                t.add(TweenLite.to(fr, duration, {
                    x: mr.x,
                    y: mr.y,
                    z: mr.z,
                    ease: ez
                }), 0);
            }

            if (controlsTarget) {
                t.add(TweenLite.to(co, duration, {
                    x: ct.x,
                    y: ct.y,
                    z: ct.z,
                    ease: ez
                }), 0);
            }

            if (cameraPos) {
                t.add(TweenLite.to(c.position, duration, {
                    x: cp.x,
                    y: cp.y,
                    z: cp.z,
                    ease: ez
                }), 0);
                t.add(TweenLite.to(c.rotation, duration, {
                    x: -1.570795326639436,
                    y: 0,
                    z: 0,
                    ease: ez
                }), 0);
                t.add(TweenLite.to(c, duration, {
                    zoom: 1,
                    ease: ez
                }), 0);
            }

            if (typeof callback === "function") {
                $.doTimeout("threeAnimationCompletionCheckTimer", 10, function() {
                    if (!t.isActive()) {
                        app.views.three.toolbar.enableItem("toolbar-three-change-view");
                        callback();
                        return false;
                    }
                    return true;
                });
            }

        },

        resizeRenderer: function(width, height){
            if (window.devicePixelRatio) {
                this.renderer.setPixelRatio (window.devicePixelRatio);
            }
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix ();
            this.composer.setSize(width, height);
            this.renderer.setSize (width, height);    
            this.render();
        },

        // Three
        render: function() {

            if (this.scene) {

                //this.controls.update();
                //this.renderer.render( this.scene, this.camera );
                this.composer.render();

                var cameraPos = this.camera.position.clone();
                var cameraRotation = this.camera.rotation.clone();
                var controlsTarget = this.controls.target.clone();

                this.rotationAxisLine.position.copy(controlsTarget);
                tp.cameraPos.copy(cameraPos);
                tp.controlsTarget.copy(controlsTarget);
                var objectPos = new THREE.Vector3(0, 0, 0);
                var distance = cameraPos.distanceTo(objectPos);

                Debug.item("Camera x", Math.round(cameraPos.x * 1000) / 1000, "three");
                Debug.item("Camera y", Math.round(cameraPos.y * 1000) / 1000, "three");
                Debug.item("Camera z", Math.round(cameraPos.z * 1000) / 1000, "three");
                Debug.item("Camera Zoom", Math.round(this.camera.zoom * 1000) / 1000, "three");

                Debug.item("Camera Rx", Math.round(cameraRotation.x * 1000) / 1000, "three");
                Debug.item("Camera Ry", Math.round(cameraRotation.y * 1000) / 1000, "three");
                Debug.item("Camera Rz", Math.round(cameraRotation.z * 1000) / 1000, "three");

                if (this.fabric) {
                    var fabricRot = this.fabric.rotation;
                    Debug.item("Fabric Rx", Math.round(fabricRot.x * 1000) / 1000, "three");
                    Debug.item("Fabric Ry", Math.round(fabricRot.y * 1000) / 1000, "three");
                    Debug.item("Fabric Rz", Math.round(fabricRot.z * 1000) / 1000, "three");
                }

                Debug.item("Azimuthal", Math.round(this.controls.getAzimuthalAngle() * 1000) / 1000, "three");
                Debug.item("Polar", Math.round(this.controls.getPolarAngle() * 1000) / 1000, "three");
                Debug.item("Distance", Math.round(distance * 1000) / 1000, "three");

            }

        },

        startAnimation: function() {

            let _this = this;

            window.requestAnimationFrame(() => {

                if (app.views.active == "three" && _this.animate) {
                    const now = performance.now();
                    while (_this.fps.length > 0 && _this.fps[0] <= now - 1000) {
                        _this.fps.shift();
                    }
                    _this.fps.push(now);
                    Debug.item("FPS", _this.fps.length, "three");
                    _this.render();
                }
                _this.startAnimation();
            });

        },

        postCreate: function() {

            Debug.item("Geometries", this.renderer.info.memory.geometries, "three");
            Debug.item("Textures", this.renderer.info.memory.textures, "three");
            Debug.item("Calls", this.renderer.info.render.calls, "three");
            Debug.item("Triangles", this.renderer.info.render.triangles, "three");
            Debug.item("Points", this.renderer.info.render.points, "three");
            Debug.item("Lines", this.renderer.info.render.lines, "three");

        },

        getFirstWarpWeft: function(threads) {
            var set;
            var firstIntersects = {
                warp: false,
                weft: false
            };
            for (var i = 0; i < threads.length; i++) {
                set = threads[i].object.userData.threadSet;
                if (!firstIntersects[set]) {
                    firstIntersects[set] = threads[i].object;
                    if (firstIntersects.warp && firstIntersects.weft) {
                        break;
                    }
                }
            }
            return firstIntersects;
        },

        outlinePass: {
            pass: undefined,
            stickyMeshIds: [],
            meshes: [],
            setup: function() {
                this.pass = new THREE.OutlinePass(new THREE.Vector2(app.frame.width, app.frame.height), q.three.scene, q.three.camera);
                this.pass.edgeStrength = 10;
                this.pass.edgeGlow = 0;
                this.pass.edgeThickness = 0.5;
                this.pass.pulsePeriod = 0;
                this.pass.visibleEdgeColor.set("#ffffff");
                this.pass.hiddenEdgeColor.set("#666666");
                q.three.composer.addPass(this.pass);
            },
            add: function(mesh, makeSticky = false) {
                if (!mesh) {
                    return;
                }
                var meshId = mesh.id;
                if (makeSticky) {
                    this.stickyMeshIds.uniquePush(meshId);
                    // console.log(["outline.add", mesh.id, makeSticky]);
                }

                var meshAlreadyOutlined = this.meshes.some(a => a.id === meshId);
                if (!meshAlreadyOutlined) {
                    this.meshes.push(mesh);
                    this.pass.selectedObjects = this.meshes;
                    q.three.render();
                }
            },
            removeSticky: function(mesh) {
                if (!mesh) {
                    return;
                }
                if (this.stickyMeshIds.includes(mesh.id)) {
                    this.stickyMeshIds = this.stickyMeshIds.remove(mesh.id);
                    this.meshes = $.grep(this.meshes, function(outlineMesh) {
                        return outlineMesh.id !== mesh.id;
                    });
                    this.pass.selectedObjects = this.meshes;
                    q.three.render();
                }
            },
            clear: function(clearSticky = false) {
                let _this = this;
                if (clearSticky) {
                    this.stickyMeshIds = [];
                    this.meshes = [];
                } else {
                    this.meshes = $.grep(this.meshes, function(mesh) {
                        return _this.stickyMeshIds.includes(mesh.id);
                    });
                }
                this.pass.selectedObjects = this.meshes;
                q.three.render();
            }
        },

        highlight: {
            uuids: [],
            add: function(mesh) {

                if (!mesh) {
                    return;
                }
                let _this = this;
                var uuid = mesh.uuid;
                var meshAlreadyHighlighted = this.uuids.some(a => a.uuid === uuid);
                if (meshAlreadyHighlighted) {
                    //this.meshes = this.outlineThreads.filter(threadObject => threadObject.uuid !== targetUUID);
                } else {
                    this.uuids.push(uuid);
                    q.three.threads.forEach(function(thread, i) {
                        if (!_this.uuids.includes(thread.uuid)) {
                            thread.material.opacity = 0.25;
                            thread.material.depthTest = false;
                        }
                    });
                    var meshMaterialName = mesh.material.name;
                    var cloneMaterial = mesh.material.clone();
                    cloneMaterial.depthTest = true;
                    cloneMaterial.opacity = 1;
                    cloneMaterial.name = mesh.material.name + "-clone";
                    mesh.material = cloneMaterial;
                    cloneMaterial.needsUpdate = true;
                    q.three.render();
                }
            },
            clear: function() {
                this.uuids = [];
                var threads = q.three.fabric.children;
                var set, code;
                for (var i = threads.length - 1; i >= 0; i--) {
                    if (threads[i].name == "thread") {
                        set = threads[i].userData.threadSet;
                        code = threads[i].userData.colorCode;
                        if (threads[i].material.name !== set + "-" + code) {
                            threads[i].material.name = set + "-" + code;
                            threads[i].material = q.three.materials[set][code];
                        }
                        threads[i].material.opacity = q.three.defaultOpacity;
                        threads[i].material.depthTest = q.three.defaultDepthTest;
                    }
                }
                q.three.render();
            }
        },

        getMeshByUUID: function(uuid) {
            var threads = q.three.fabric.children;
            for (var i = threads.length - 1; i >= 0; i--) {
                if (threads[i].uuid == uuid) {
                    return threads[i];
                }
            }
        },

        // q.three.doMouseInteraction
        doMouseInteraction: function(type, which, canvasMouse) {

            let _this = this;
            var mx = (canvasMouse.x / app.frame.width) * 2 - 1;
            var my = (canvasMouse.y / app.frame.height) * 2 - 1;
            this.raycaster.setFromCamera({
                x: mx,
                y: my
            }, this.camera);
            var intersects = this.raycaster.intersectObjects(this.threads);
            var firstIntersects = this.getFirstWarpWeft(intersects);

            var warpThreei = -1;
            var weftThreei = -1;

            if (firstIntersects.warp) {
                warpThreei = Number(firstIntersects.warp.userData.threei) + 1;
            }

            if (firstIntersects.weft) {
                weftThreei = Number(firstIntersects.weft.userData.threei) + 1;
            }

            if (warpThreei > 0 && weftThreei > 0) {
                let mouseTipText = warpThreei + ", " + weftThreei;
                MouseTip.text(0, mouseTipText);

            } else if (warpThreei > 0 && weftThreei == -1) {
                let mouseTipText = "End: " + warpThreei;
                MouseTip.text(0, mouseTipText);

            } else if (warpThreei == -1 && weftThreei > 0) {
                let mouseTipText = "Pick: " + weftThreei;
                MouseTip.text(0, mouseTipText);

            } else {
                MouseTip.remove(0);

            }

            Debug.item("threeIntersection", warpThreei + ", " + weftThreei, "three");

            if (tp.mouseHoverOutline && intersects.length) {
                this.outlinePass.clear();
                this.outlinePass.add(firstIntersects.warp);
                this.outlinePass.add(firstIntersects.weft);
            }
            if (!intersects.length && this.outlinePass.meshes.length) {
                this.outlinePass.clear();
            }

            if (tp.mouseHoverHighlight && intersects.length) {
                this.highlight.clear();
                this.highlight.add(firstIntersects.warp);
                this.highlight.add(firstIntersects.weft);
            }
            if (!intersects.length && this.highlight.uuids.length) {
                this.highlight.clear();
            }

            if (type == "dblclick" && which == 1 && !firstIntersects.warp && !firstIntersects.weft) {
                this.outlinePass.clear(true);
            }

            if (type == "dblclick" && which == 1 && firstIntersects.warp && firstIntersects.weft) {

                var endIndex = firstIntersects.warp.userData.weavei;
                var pickIndex = firstIntersects.weft.userData.weavei;
                q.graph.set(0, "weave", "toggle", {
                    col: endIndex + 1,
                    row: pickIndex + 1,
                    trim: false
                });
                _this.weave2D8 = q.graph.weave2D8.tileFill(tp.warpThreads, tp.weftThreads, 1 - tp.warpStart, 1 - tp.weftStart);

                var replaceThreads = [];
                _this.threads = $.grep(_this.threads, function(thread, i) {
                    if (thread.userData.weaveId.in("warp-" + endIndex, "weft-" + pickIndex)) {
                        replaceThreads.push(thread);
                        return false;
                    } else {
                        return true;
                    }
                });

                replaceThreads.forEach(function(thread) {
                    var threeId = thread.userData.threeId;
                    var threeIdParts = threeId.split("-");
                    var yarnSet = threeIdParts[0];
                    var threeIndex = Number(threeIdParts[1]);
                    var removeMeshId = _this.removeThread(yarnSet, threeIndex);
                    var newMeshId = _this.addThread(yarnSet, threeIndex);
                    if (tp.mouseHoverOutline) {
                        var makeSticky = _this.outlinePass.stickyMeshIds.includes(removeMeshId);
                        _this.outlinePass.removeSticky(thread);
                        var newThread = q.three.scene.getObjectById(newMeshId);
                        _this.outlinePass.add(newThread, makeSticky);
                        _this.outlinePass.meshes = $.grep(_this.outlinePass.meshes, function(mesh) {
                            return _this.outlinePass.stickyMeshIds.includes(mesh.id);
                        });
                    }
                });
                _this.render();
                _this.doMouseInteraction("mousemove", 0, canvasMouse);
            }

            if (type == "click" && which == 1) {
                if (tp.mouseHoverOutline && intersects.length) {
                    var stickyWarpClick = firstIntersects.warp && this.outlinePass.stickyMeshIds.includes(firstIntersects.warp.id);
                    var stickyWeftClick = firstIntersects.weft && this.outlinePass.stickyMeshIds.includes(firstIntersects.weft.id);
                    if (stickyWarpClick && stickyWeftClick) {
                        this.outlinePass.removeSticky(firstIntersects.warp);
                        this.outlinePass.removeSticky(firstIntersects.weft);
                    } else if (stickyWarpClick && !firstIntersects.weft) {
                        this.outlinePass.removeSticky(firstIntersects.warp);
                    } else if (stickyWeftClick && !firstIntersects.warp) {
                        this.outlinePass.removeSticky(firstIntersects.weft);
                    } else {
                        this.outlinePass.add(firstIntersects.warp, true);
                        this.outlinePass.add(firstIntersects.weft, true);
                    }
                }
            }

        }

    };

    $(document).on("mousedown mouseup", q.ids("three"), function(e) {
        app.mouse.event("three", e, function(type, which, x, y) {
            var canavsMouse = getGraphMouse("three", x, y);
            q.three.doMouseInteraction(type, which, canavsMouse);
        });
    });

    function waveSegmentPoints(towards, sx, sy, sz, w, h, bca, segmentPoints, dir, removeLastPoint = true) {

        var staPoint, endPoint, control1, control2;

        h = dir ? h : -h;

        staPoint = new THREE.Vector3(sx, sy + h / 2, sz);

        if (towards == "z") {

            control1 = new THREE.Vector3(sx, sy + h / 2, sz + bca);
            control2 = new THREE.Vector3(sx, sy - h / 2, sz + w - bca);
            endPoint = new THREE.Vector3(sx, sy - h / 2, sz + w);

        } else if (towards == "x") {

            control1 = new THREE.Vector3(sx - bca, sy + h / 2, sz);
            control2 = new THREE.Vector3(sx - w + bca, sy - h / 2, sz);
            endPoint = new THREE.Vector3(sx - w, sy - h / 2, sz);

        }

        var curve = new THREE.CubicBezierCurve3(staPoint, control1, control2, endPoint);
        var points = curve.getPoints(segmentPoints);

        if (removeLastPoint) {
            points.pop();
        }

        return points;

    }

    $(document).on("mouseover", q.ids("model"), function(evt) {

    });

    $(document).on("mouseout", q.ids("model"), function(evt) {

    });

    $(document).on("mousedown mouseup", q.ids("model"), function(e) {
        console.log(e.type);
        app.mouse.event("model", e, function(type, which, x, y) {
            var canavsMouse = getGraphMouse("model", x, y);
            q.model.doMouseInteraction(type, which, canavsMouse);
        });
    });

    function getThreadUpDownArray(arr2D8, threadSet, threadi) {

        var threadArr;

        if (threadSet == "warp") {

            threadArr = arr2D8[threadi];

        } else if (threadSet == "weft") {

            var w = arr2D8.length;
            var h = arr2D8[0].length;
            threadArr = new Uint8Array(w);

            for (var x = 0; x < w; x++) {
                threadArr[x] = 1 - arr2D8[x][threadi];
            }

        }

        return threadArr;

    }

    // ----------------------------------------------------------------------------------
    // Objects & Methods
    // ----------------------------------------------------------------------------------
    var globalPosition = {
        warp: [],
        weft: [],
        tieup: [],
        lifting: [],
        threading: [],
        weave: [],
        artwork: [],
        simulation: [],
        three: [],
        model: [],
        update: function(graph) {
            var el = document.getElementById(graph + "-container").getBoundingClientRect();
            q.position[graph] = [el.width, el.height, el.top, el.left, el.bottom, el.right];
        }
    };

    var globalPattern = {

        warp: [],
        weft: [],

        mouseDown: {
            warp: false,
            weft: false
        },

        rightClick: {
            yarnset: "",
            threadNum: 0,
            code: ""
        },

        fillToWeave: function(yarnSet = "fabric") {

            let weave = q.graph.weave2D8;
            let weaveW = weave.length;
            let weaveH = weave[0].length;

            let patternW = q.pattern.warp.length;
            let patternH = q.pattern.weft.length;

            let fabricRepeatW = [weaveW, patternW].lcm();
            let fabricRepeatH = [weaveH, patternH].lcm();

            if (fabricRepeatW > patternW && yarnSet.in("warp", "fabric")) {
                let newPattern = q.pattern.warp.tileFill(fabricRepeatW);
                q.pattern.set(21, "warp", newPattern);
            }

            if (fabricRepeatH > patternH && yarnSet.in("weft", "fabric")) {
                let newPattern = q.pattern.weft.tileFill(fabricRepeatH);
                q.pattern.set(22, "weft", newPattern);
            }

        },

        shuffle: function(yarnSet = "fabric") {

            if (yarnSet.in("warp", "fabric")) {
                var warp = this.warp.slice().shuffle();
                q.pattern.set(1, "warp", warp);
            }

            if (yarnSet.in("weft", "fabric")) {
                var weft = this.weft.slice().shuffle();
                q.pattern.set(1, "weft", weft);
            }

        },

        stripeAt: function(set, index) {

            var pat = set.in("warp", "weft") ? this[set] : set;
            if (index >= pat.length) {
                return false;
            }

            let decoded = decodePattern(pat);
            let sum = 0;
            let stripeIndex = 0;

            for (let i = 0; i < decoded.nums.length; i++) {
                sum += decoded.nums[i];
                if (sum > index) {
                    stripeIndex = i;
                    break;
                }
            }

            var val = pat[index];
            var leftPart = pat.slice(0, index).reverse();
            var rightPart = pat.slice(index + 1, pat.length);
            var start = leftPart.length;
            for (var i = 0; i < leftPart.length; i++) {
                if (leftPart[i] == val) {
                    start--;
                } else {
                    break;
                }
            }
            var end = index;
            for (i = 0; i < rightPart.length; i++) {
                if (rightPart[i] == val) {
                    end++;
                } else {
                    break;
                }
            }
            var size = end - start + 1;
            return {
                start: start,
                end: end,
                size: size,
                val: val,
                index: stripeIndex
            };

        },

        updateStatusbar: function() {

            var wps = this.warp.length;
            var wfs = this.weft.length;

            var wpc = this.colors("warp").length;
            var wfc = this.colors("weft").length;
            var fbc = this.colors("fabric").length;

            var wpt = this.stripeCount("warp");
            var wft = this.stripeCount("weft");

            var wpr = [wps, q.graph.ends].lcm();
            var wfr = [wfs, q.graph.picks].lcm();

            Status.patternSize(wps, wfs);
            Status.colors(wpc, wfc, fbc);
            Status.stripes(wpt, wft);
            Status.repeat(wpr, wfr);

        },

        get: function(yarnSet, startNum = 0, len = 0) {

            var res = q.pattern[yarnSet].clone();
            if (startNum) {
                var startIndex = startNum - 1;
                var seamless = lokup(yarnSet, ["warp", "weft"], [gp.seamlessWarp, gp.seamlessWeft]);
                var overflow = seamless ? "loop" : "extend";
                res = copy1D(res, startIndex, startIndex + len - 1, overflow, "a");
            }
            return res;

        },

        size: function(yarnSet) {
            return q.pattern[yarnSet].length;
        },

        insert: function(yarnSet, item, posi, repeat = 1) {

            if ($.isArray(item)) {
                item = item.join("");
            }
            item = item.repeat(repeat).split("");
            var pat = this[yarnSet].slice();
            pat = pat.insert(posi, item);
            q.pattern.set(1, yarnSet, pat);

        },

        removeBlank: function(yarnSet) {
            q.pattern.set(1, yarnSet, q.pattern[yarnSet].removeItem("0"));
        },

        delete: function(yarnSet, start, end) {
            if (start > end) {
                [start, end] = [end, start];
            }
            var left = this[yarnSet].slice(0, start);
            var right = this[yarnSet].slice(end + 1, q.limits.maxPatternSize - 1);
            q.pattern.set(1, yarnSet, left.concat(right));
        },

        clear: function(set) {
            if (isSet(set) && typeof set === "string") {
                if (set == "warp") q.pattern.set(45, set, "a");
                if (set == "weft") q.pattern.set(45, set, "b");
            } else {
                app.history.off();
                q.pattern.set(46, "warp", "a", false);
                q.pattern.set(47, "weft", "b", true);
                app.history.on();
                app.history.record("pattern.clear", "warp", "weft");
            }
        },

        shift: function(dirs, amount = 1) {
            var amt;
            dirs = dirs.split(" ");
            if (dirs.contains("left", "right")) {
                amt = dirs.includes("right") ? amount : -amount;
                q.pattern.set(48, "warp", q.pattern.get("warp").shift1D(amt));
            }
            if (dirs.contains("up", "down")) {
                amt = dirs.includes("up") ? amount : -amount;
                q.pattern.set(48, "weft", q.pattern.get("weft").shift1D(amt));
            }
        },

        stripeCount: function(yarnSet) {
            var pattern = q.pattern[yarnSet];
            var stripes = [];
            stripes.push(pattern[0]);
            for (var i = 1; i < pattern.length; i++) {

                if (pattern[i] !== pattern[i - 1]) {
                    stripes.push(pattern[i]);
                }

            }

            if (stripes[0] == stripes[stripes.length - 1]) {
                stripes.pop();
            }

            return stripes.length;
        },

        fillStripe: function(yarnSet, threadNum, code) {
            var stripeData = getStripeData(q.pattern[yarnSet], threadNum - 1);
            var stripeSize = stripeData[2];
            var stripeArray = filledArray(code, stripeSize);
            var newPattern = paste1D(stripeArray, q.pattern[yarnSet], stripeData[0]);
            q.pattern.set(21, yarnSet, newPattern);
        },

        colors: function(yarnSet = "fabric") {
            var arr = ["warp", "weft"].includes(yarnSet) ? this[yarnSet] : this.warp.concat(this.weft);
            return arr.filter(Boolean).unique();
        },

        format: function(pattern) {
            if (typeof pattern === "string") {
                pattern = pattern.replace(/[^A-Za-z0]/g, "");
                pattern = pattern.split("");
            }
            return pattern;
        },

        // q.pattern.set:
        set: function(instanceId, yarnSet, pattern = false, renderWeave = true, threadNum = 0, overflow = false) {

            if (yarnSet === undefined) {
                app.history.off();
                q.pattern.set("noYarnSet", "warp", pattern, renderWeave, threadNum, overflow);
                q.pattern.set("noYarnSet", "weft", pattern, renderWeave, threadNum, overflow);
                app.history.on();
                app.history.record("noYarnSet", "warp", "weft");
                return;
            }

            if (pattern) {
                pattern = q.pattern.format(pattern);
                if (threadNum) pattern = paste1D(pattern, this[yarnSet], threadNum - 1, overflow, "a");
                this[yarnSet] = pattern;
            }

            q.pattern.needsUpdate(4, yarnSet);

            if (renderWeave) q.graph.needsUpdate(7, "weave");
            app.history.record("pattern.set", yarnSet);

            q.palette.updateChipArrows();
            q.pattern.updateStatusbar();

        },

        warpNeedsUpdate: true,
        weftNeedsUpdate: true,

        needsUpdate: function(instanceId, yarnSet, updateNow = true) {
            if (yarnSet === undefined || yarnSet === "warp") this.warpNeedsUpdate = true;
            if (yarnSet === undefined || yarnSet === "weft") this.weftNeedsUpdate = true;
            if (updateNow) this.update();
        },

        // q.pattern.update:
        update: function(instanceId) {

            if (app.views.active !== "graph") return;

            if (this.warpNeedsUpdate) {
                Debug.item("warp", false, "update");
                Selection.get("warp").scrollX = q.graph.scroll.x;
                this.render("warp");
                this.warpNeedsUpdate = false;
            }

            if (this.weftNeedsUpdate) {
                Debug.item("weft", false, "update");
                Selection.get("weft").scrollY = q.graph.scroll.y;
                this.render("weft");
                this.weftNeedsUpdate = false;
            }

        },

        // q.pattern.renderSet:
        render: function(yarnSet) {

            Debug.time("render > " + yarnSet);

            var i, state, arrX, arrY, drawX, drawY, code, color, colors, r, g, b, a, patternX, patternY, rectW, rectH, opacity;
            var threadi, gradientOrientation, index;
            var scrollX, scrollY;

            var id = yarnSet + "Display";
            var ctx = q.context[id];
            if (!ctx) return;
            let pixels = q.pixels[id];
            let pixels8 = q.pixels8[id];
            let pixels32 = q.pixels32[id];

            var elW = ctx.canvas.clientWidth;
            var elH = ctx.canvas.clientHeight;
            
            var ctxW = ctx.canvas.width;
            var ctxH = ctx.canvas.height;
            //ctx.clearRect(0, 0, ctxW, ctxH);

            var isWarp = yarnSet == "warp";
            var isWeft = !isWarp;

            let offset = isWarp ? q.graph.scroll.x : q.graph.scroll.y;
            let seamless = isWarp ? gp.seamlessWarp : gp.seamlessWeft;

            // Background Stripes
            var light32 = app.ui.check.light;
            var dark32 = app.ui.check.dark;

            var gridLight = app.ui.grid.light;
            var gridDark = app.ui.grid.dark;

            var ppg = gp.pointPlusGrid;

            if (isWarp) {
                for (let x = 0; x < ctxW; ++x) {
                    threadi = ~~((x - offset) / ppg);
                    for (let y = 0; y < ctxH; ++y) {
                        i = y * ctxW;
                        pixels32[i + x] = threadi & 1 ? light32 : dark32;
                    }
                }
            } else {
                for (let y = 0; y < ctxH; ++y) {
                    threadi = ~~((y - offset) / ppg);
                    i = (ctxH - y - 1) * ctxW;
                    for (let x = 0; x < ctxW; ++x) {
                        pixels32[i + x] = threadi & 1 ? light32 : dark32;
                    }
                }
            }

            var pattern = q.pattern[yarnSet];
            var patternSize = pattern.length;
            if (!patternSize) return;

            let drawSpace = isWarp ? ctxW : ctxH;
            var pointDrawOffset = offset % ppg;
            var maxPoints = Math.ceil((drawSpace - pointDrawOffset) / ppg);
            var offsetPoints = Math.floor(Math.abs(offset) / ppg);
            var drawPoints = seamless ? maxPoints : Math.min(patternSize - offsetPoints, maxPoints);
            var drawStartIndex = offsetPoints;
            var drawLastIndex = drawStartIndex + drawPoints;

            if (isWarp) {
                drawY = 0;
                rectW = ppg;
                rectH = Math.round(app.ui.patternSpan * q.pixelRatio);
                for (i = drawStartIndex; i < drawLastIndex; ++i) {
                    index = loopNumber(i, patternSize);
                    code = q.pattern[yarnSet][index];
                    drawX = (i - drawStartIndex) * ppg + pointDrawOffset;
                    if (!q.palette.colors[code]) {
                        console.log(q.palette.colors);
                    }
                    color = q.palette.colors[code].rgba_visible;
                    buffRectSolid(app.origin, pixels8, pixels32, ctxW, ctxH, drawX, drawY, rectW, rectH, color);
                }
            } else {
                drawX = 0;
                rectW = Math.round(app.ui.patternSpan * q.pixelRatio);
                rectH = ppg;
                for (i = drawStartIndex; i < drawLastIndex; ++i) {
                    index = loopNumber(i, patternSize);
                    code = q.pattern[yarnSet][index];
                    drawY = (i - drawStartIndex) * ppg + pointDrawOffset;
                    color = q.palette.colors[code].rgba_visible;
                    buffRectSolid(app.origin, pixels8, pixels32, ctxW, ctxH, drawX, drawY, rectW, rectH, color);
                }
            }

            if (gp.showGrid) {
                let origin = app.origin;
                let ppg_wp = isWarp ? ppg : 0;
                let ppg_wf = isWeft ? ppg : 0;
                let majorEvery = gp.showMajorGrid ? gp.majorGridEvery : 0;
                bufferGrid(origin, pixels8, pixels32, ctxW, ctxH, ppg_wp, ppg_wf, offset, offset, gp.showMinorGrid, majorEvery, majorEvery, gridLight, gridDark);
            }

            ctx.putImageData(pixels, 0, 0);

            Debug.timeEnd("render > " + yarnSet, "perf");

        }

    };

    var patternRightClick = {
        "yarnSet": "",
        "threadIndex": 0,
        "colorCode": ""
    };

    // ----------------------------------------------------------------------------------
    // GLOBAL ARTWORK
    // ----------------------------------------------------------------------------------
    var globalStatusbar = {

        switchTo: function(view) {

            $("#sb-" + view).show();
            $(".sb-group").not("#sb-" + view).hide();

        },

        set: function(item, var1, var2, var3) {

            var ww, wh, pw, ph, txt;

            if (item == "patternSize") {

                var1 = q.pattern.warp.length;
                var2 = q.pattern.weft.length;
                $("#sb-pattern-size").text("[" + var1 + " \xD7 " + var2 + "]");

            } else if (item == "colorCount") {

                var1 = q.pattern.colors("warp").length;
                var2 = q.pattern.colors("weft").length;
                var3 = q.pattern.colors("fabric").length;
                $("#sb-color-count").text("Colors: " + var1 + " \xD7 " + var2 + " \x2F " + var3);

            } else if (item == "stripeCount") {

                var1 = q.pattern.stripeCount("warp");
                var2 = q.pattern.stripeCount("weft");
                $("#sb-stripe-count").text("Stripes: " + var1 + " \xD7 " + var2);

            } else if (item == "shafts") {
                var shafts = q.graph.shafts;
                if (shafts <= q.limits.maxShafts) {
                    $("#sb-graph-3").text("Shafts = " + shafts);
                } else {
                    $("#sb-graph-3").text("Shafts > " + q.limits.maxShafts);
                }

            } else if (item == "graphIntersection") {
                $("#sb-graph-1").text(var1 + ", " + var2);

            } else if (item == "graph-icon") {

                var src = $("#sb-graph-icon").find("img").attr("src");
                if (src !== var1) {
                    $("#sb-graph-icon img").attr("src", "img/icons/" + var1);
                }

            } else if (item == "threadingIntersection") {
                $("#sb-threading-intersection").text(var1 + ", " + var2);

            } else if (item == "liftingIntersection") {

                $("#sb-lifting-intersection").text(var1 + ", " + var2);

            } else if (item == "tieupIntersection") {
                $("#sb-tieup-intersection").text(var1 + ", " + var2);

            } else if (item == "artworkIntersection") {

                $("#sb-artwork-intersection").text(var1 + ", " + var2);

            } else if (item == "artworkSize") {

                var1 = q.artwork.width;
                var2 = q.artwork.height;
                $("#sb-artwork-size").text(var1 + " \xD7 " + var2);

            } else if (item == "patternThread") {

                $("#sb-pattern-thread").text(var1 + ": " + var2);

            } else if (item == "stripeSize") {

                $("#sb-pattern-stripe-size").text("[" + var1 + "]");

            } else if (item == "graphSize") {

                $("#sb-graph-2").text("[" + var1 + " \xD7 " + var2 + "]");

            } else if (item == "artworkColor") {

                if (isNaN(var2)) {
                    $("#sb-artwork-color-chip").css({
                        "background-image": "linear-gradient(135deg, #cccccc 14.29%, #eeeeee 14.29%, #eeeeee 50%, #cccccc 50%, #cccccc 64.29%, #eeeeee 64.29%, #eeeeee 100%)",
                        "background-size": "5.00px 5.00px",
                        "background-color": "none"
                    });
                } else {
                    $("#sb-artwork-color-chip").css({
                        "background-image": "none",
                        "background-color": var1
                    });
                }
                $("#sb-artwork-color-index").text(var2);

            } else if (item == "colorChip") {

                if (var1 == "") {
                    $("#sb-pattern-color").css({
                        "background-image": "url(img/no-color.gif)",
                        "background-position": "center center",
                        "background-color": "#F0F0DD",
                        "background-repeat": "no-repeat"
                    });
                    $("#sb-pattern-code").text("\xD7");
                } else {
                    $("#sb-pattern-color").css({
                        "background-image": "none",
                        "background-color": q.palette.colors[var1].hex
                    });
                    $("#sb-pattern-code").text(var1);
                }

            } else if (item == "serverConnecting") {

                $("#sb-login").find(".sb-icon img").attr("src", "img/icon-server-connecting.png");
                $("#sb-server-status").text("Connecting Server");

            } else if (item == "loginSuccessful") {

                $("#sb-login").find(".sb-icon img").attr("src", "img/icon-server-connected.png");
                $("#sb-server-status").text("Login Successful");

            } else if (item == "loginFail") {

                $("#sb-login").find(".sb-icon img").attr("src", "img/icon-server-disconnected.png");
                $("#sb-server-status").text("Login Fail");

            } else if (item == "threeIntersection") {

                ww = q.graph.ends;
                wh = q.graph.picks;
                pw = q.pattern.warp.length;
                ph = q.pattern.weft.length;

                var tx = "-";
                var wx = "-";
                var px = "-";

                var ty = "-";
                var wy = "-";
                var py = "-";

                if (var1) {
                    tx = var1 + tp.warpStart - 1;
                    wx = loopNumber(tx - 1, ww) + 1;
                    px = loopNumber(tx - 1, pw) + 1;
                }

                if (var2) {
                    ty = var2 + tp.weftStart - 1;
                    wy = loopNumber(ty - 1, wh) + 1;
                    py = loopNumber(ty - 1, ph) + 1;
                }

                $("#sb-three-fabric-intersection").text(tx + ", " + ty);
                $("#sb-three-weave-intersection").text(wx + ", " + wy);
                $("#sb-three-pattern-intersection").text(px + ", " + py);

            } else if (item == "threeSizes") {

                ww = q.graph.ends;
                wh = q.graph.picks;
                pw = q.pattern.warp.length;
                ph = q.pattern.weft.length;

                $("#sb-three-weave-size").text(ww + " \xD7 " + wh);
                $("#sb-three-pattern-size").text(pw + " \xD7 " + ph);

            }

        }

    };

    function scaleImagePixelArray(sourceArr, targetW, targetH) {
        Debug.time("scaleImagePixelArray");
        var sx, sy, tx, ty;
        var sourceW = sourceArr.length;
        var sourceH = sourceArr[0].length;
        var targetArr = newArray2D8(17, targetW, targetH);
        var xRatio = sourceW / targetW;
        var yRatio = sourceH / targetH;
        var halfW = targetW / 2 - 0.5;
        var halfH = targetH / 2 - 0.5;
        // If Downscaling
        for (tx = 0; tx < targetW; ++tx) {
            if (tx <= halfW) {
                sx = Math.round(tx * xRatio + yRatio / 2);
            } else {
                sx = Math.floor(tx * xRatio + yRatio / 2 - 0.5);
            }
            for (ty = 0; ty < targetH; ++ty) {
                if (ty <= halfH) {
                    sy = Math.round(ty * yRatio + yRatio / 2);
                } else {
                    sy = Math.floor(ty * yRatio + yRatio / 2 - 0.5);
                }
                targetArr[tx][ty] = sourceArr[sx][sy];
            }
        }
        Debug.timeEnd("scaleImagePixelArray");
        return targetArr;
    }

    function scaleImagePixelArray8(sourceArr, targetW, targetH) {
        Debug.time("scaleImagePixelArray");
        var sx, sy, tx, ty, si, ti;

        var [sourceW, sourceH] = sourceArr.get("wh");
        var targetArr = new Uint8Array(targetW * targetH + 2);
        targetArr.setWidth(targetW);

        var xRatio = sourceW / targetW;
        var yRatio = sourceH / targetH;
        var halfW = targetW / 2 - 0.5;
        var halfH = targetH / 2 - 0.5;
        // If Downscaling
        for (tx = 0; tx < targetW; ++tx) {
            if (tx <= halfW) {
                sx = Math.round(tx * xRatio + yRatio / 2);
            } else {
                sx = Math.floor(tx * xRatio + yRatio / 2 - 0.5);
            }
            for (ty = 0; ty < targetH; ++ty) {
                if (ty <= halfH) {
                    sy = Math.round(ty * yRatio + yRatio / 2);
                } else {
                    sy = Math.floor(ty * yRatio + yRatio / 2 - 0.5);
                }

                si = sy * sourceW + sx + 2;
                ti = ty * targetW + tx + 2;

                targetArr[ti] = sourceArr[si];
            }
        }
        Debug.timeEnd("scaleImagePixelArray");
        return targetArr;
    }

    var globalArtwork = {

        _tool: "pointer",
        get tool() {
            return this._tool;
        },
        set tool(value) {
            if (this._tool !== value) {
                this._tool = value;
                setToolbarTwoStateButtonGroup("artwork", "artworkTools", value);
            }
        },

        palette: undefined,
        colors32: undefined,

        _artwork2D8: false,
        artwork8: undefined,
        get artwork2D8() {
            return this._artwork2D8;
        },
        set artwork2D8(arr) {
            this._artwork2D8 = arr.clone2D8();
            this.width = arr.length;
            this.height = arr[0].length;
            // this.setSize();
            Status.artworkSize(this.width, this.height);
            this.update();
        },

        width: 0,
        height: 0,

        // Artwork
        params: {

            _showGrid: true,
            get showGrid() {
                return this._showGrid;
            },
            set showGrid(state) {
                this._showGrid = state;
                q.artwork.render();
                app.config.save(7);
            },

            _crosshair: true,
            get crosshair() {
                return this._crosshair;
            },
            set crosshair(state) {
                this._crosshair = state;
                Selection.get("artwork").showCrosshair = state;
                app.views.artwork.toolbar.setItemState("toolbar-artwork-crosshair", state);
                if (state) {
                    app.views.artwork.toolbar.setItemImage("toolbar-artwork-crosshair", "crosshair_on.svg");
                } else {
                    app.views.artwork.toolbar.setItemImage("toolbar-artwork-crosshair", "crosshair_off.svg");
                }
                app.config.save(15);
            },

            resizeArtwork: [
                ["number", "Width", "resizeWidth", 2, {
                    min: 2,
                    max: q.limits.maxArtworkSize
                }],
                ["number", "Height", "resizeHeight", 2, {
                    min: 2,
                    max: q.limits.maxArtworkSize
                }],
                ["check", "Maintain Ratio", "resizeMaintainRatio", 1],
                ["control", "play"]
            ],

            viewSettings: [

                ["check", "Seamless X", "seamlessX", 0],
                ["check", "Seamless Y", "seamlessY", 0],
                ["check", "Minor Grid", "showMinorGrid", 1],
                ["check", "Major Grid", "showMajorGrid", 1],

                ["number", "V-Major Every", "vMajorGridEvery", 8, {
                    min: 2,
                    max: 300
                }],
                ["number", "H-Major Every", "hMajorGridEvery", 8, {
                    min: 2,
                    max: 300
                }]

            ],

            outline: [
                ["text", "Base Color", "outlineBaseColor", "", {
                    col: "1/1"
                }],
                ["number", "Stroke Color", "outlineStrokeColor", "0", {
                    col: "1/3",
                    min: 0,
                    max: 255
                }],
                ["number", "OutlineSize", "outlineStrokeSize", 4, {
                    col: "1/3",
                    min: 1,
                    max: 9999
                }],
                ["check", "Rounded", "outlineStrokeRounded", 0],
                ["select", "Position", "colorStrokePosition", [
                    ["outside", "Outside"],
                    ["inside", "Inside"],
                    ["both", "Both Side"]
                ], {
                    col: "3/5"
                }],
                ["check", "Grouping", "colorStrokeGrouping", 1],
                ["control", "play"]
            ],

            shadow: [

                ["number", "Shadow Color", "shadowColor", "0", {
                    col: "1/3",
                    min: 0,
                    max: 255
                }],
                ["text", "Shadowed Colors", "shadowedColors", "", {
                    col: "1/1"
                }],
                ["check", "Shaded Colors", "lockShadedColors", 0],
                ["text", false, "shadedColors", "", {
                    col: "1/1"
                }],
                ["number", "Shadow Range", "shadowRange", 4, {
                    col: "1/3",
                    min: 1,
                    max: 9999
                }],
                ["angle", "Shadow Direction", "shadowDirection", 0, {
                    col: "1/3",
                    min: 0,
                    max: 360
                }],
                ["control", "play"]

            ],

            colorChange: [
                ["check", "Swap Colors", "swapColors", 0],
                ["text", "From Colors", "fromColors", "", {
                    col: "1/1"
                }],
                ["number", "From Color", "fromColor", "0", {
                    col: "1/3",
                    min: 0,
                    max: 255
                }],
                ["number", "To Color", "toColor", "0", {
                    col: "1/3",
                    min: 0,
                    max: 255
                }],
                ["control", "play"]
            ],

            editColor: [
                ["dynamicHeader", false, "editColorCaption", "Artwork Color "],
                ["color", "Color", "colorWeaveColor", "#000000", {
                    col: "2/3"
                }],
                ["number", "Offset X", "colorWeaveOffsetX", 0, {
                    col: "1/3",
                    min: -9999,
                    max: 9999
                }],
                ["number", "Offset Y", "colorWeaveOffsetY", 0, {
                    col: "1/3",
                    min: -9999,
                    max: 9999
                }],
                ["control"]
            ]

        },

        // q.artwork.setInterface
        setInterface: function(instanceId = 0, render = true) {

            // console.log(["q.artwork.setInterface", instanceId]);
            //logTime("q.artwork.setInterface("+instanceId+")");

            var artworkBoxL = Scrollbars.size;
            var artworkBoxB = Scrollbars.size;

            var artworkBoxW = app.frame.width - Scrollbars.size;
            var artworkBoxH = app.frame.height - Scrollbars.size;

            $("#artwork-container").css({
                "width": artworkBoxW,
                "height": artworkBoxH,
                "left": artworkBoxL,
                "bottom": artworkBoxB,
            });

            let ctx = q.ctx(173, "artwork-container", "artworkDisplay", artworkBoxW, artworkBoxH, true, true);
            ctx.clearRect(0, 0, artworkBoxW, artworkBoxH);

            var artworkLayerContext = q.ctx(61, "artwork-container", "artworkLayerDisplay", artworkBoxW, artworkBoxH);
            artworkLayerContext.clearRect(0, 0, artworkBoxW, artworkBoxH);
            Selection.get("artwork").ctx = artworkLayerContext;

            if (q.artwork.scroll == undefined) {
                q.artwork.scroll = new Scrollbars({
                    id: "artwork",
                    parent: "artwork-frame",
                    view: "artwork-container",
                    onScroll: function(xy, pos) {
                        q.artwork.render("onScroll");
                    }
                });
            }

            q.artwork.scroll.set({
                horizontal: {
                    width: artworkBoxW,
                    right: 0,
                    bottom: 0
                },
                vertical: {
                    height: artworkBoxH,
                    left: 0,
                    top: 0
                }
            });

            if (render) {
                q.artwork.createPalette();
                q.artwork.update();
                q.artwork.render("q.artwork.setInterface");
            }

            q.position.update("artwork");

            //logTimeEnd("q.artwork.setInterface("+instanceId+")");

        },

        clear: function() {
            this._artwork2D8 = false;
            this.width = 0;
            this.height = 0;
            Status.artworkSize(this.width, this.height);
            this.artwork8 = undefined;
            this.resetPalette();
            this.render();
            q.artwork.history.record("q.artwork.clear", "artwork");
        },

        update: function() {
            if (!is2D8(this.artwork2D8)) return;
            this.artwork8 = arr2D8_arr8(this.artwork2D8);
        },

        resetPalette: function() {
            console.log("resetPalette");
            this.palette = false;
            this.createPalette();
            app.wins.artworkColors.domNeedsUpdate = true;
            XWin.render("q.artwork.set", "artworkColors");
        },

        createPalette: function() {
            if (!this.palette) {
                let n = q.limits.maxArtworkColors;
                this.palette = new Array(n);
                for (let i = n-1; i >= 0; i--) {
                    this.palette[i] = {
                        hex: app.colors.black.hex,
                        color32: app.colors.black.color32,
                        count: 0,
                        percent: 0,
                        mask: false,
                        key: false,
                        transparent: false,
                        offsetx: 0,
                        offsety: 0,
                        weaveIsApplied: false,
                        weaveName: undefined,
                        weaveId: undefined,
                        weave: undefined
                    };
                }
            }
            this.compileColors32();
        },

        compileColors32: function() {
            let colorLimit = q.limits.maxArtworkColors;
            this.colors32 = new Uint32Array(colorLimit);
            for (let i = colorLimit-1; i >= 0; i--) this.colors32[i] = this.palette[i].color32;
        },

        setColor: function(index, hex, render = true) {
            q.artwork.palette[index].hex = hex;
            q.artwork.palette[index].color32 = hex_rgba32(hex);
            q.artwork.compileColors32();
            if (render) q.artwork.render();
        },

        applyWeaveToColor: function(colorId, weaveId, offsetX = 0, offsetY = 0) {
            var weave = q.graph.weaves[weaveId];
            var weave2D8 = weave.weave2D8.clone2D8();
            let ac = q.artwork.palette[colorId];
            ac.weaveIsApplied = true;
            ac.weaveId = weaveId;
            ac.weaveName = weave.title;
            ac.weave = weave2D8.clone2D8();
            ac.offsetx = offsetX;
            ac.offsety = offsetY;
            let li = XWin.getLibraryItemDomById("artworkColors", false, colorId);
            li.find(".txt-title").text(weave.title);
            li.find(".txt-info").text(weave2D8.length + "\xD7" + weave2D8[0].length + " \xA0 \xA0 x:" + offsetX + " \xA0 y:" + offsetY);
            var aww = q.artwork.width;
            var awh = q.artwork.height;
            var res2D8 = newArray2D8(1, aww, awh);
            res2D8 = paste2D8(q.graph.weave2D8, res2D8);
            if (offsetX) {
                weave2D8 = weave2D8.transform2D8(22, "shiftx", -offsetX);
            }
            if (offsetY) {
                weave2D8 = weave2D8.transform2D8(23, "shifty", -offsetY);
            }
            var fillWeave = arrayTileFill(weave2D8, aww, awh);
            for (let x = 0; x < aww; x++) {
                for (let y = 0; y < awh; y++) {
                    if (q.artwork.artwork2D8[x][y] == colorId) {
                        res2D8[x][y] = fillWeave[x][y];
                    }
                }
            }
            q.graph.set(0, "weave", res2D8);
        },

        colorChange: function(from, to, swap = false) {
            from = csvStringToIntArray(from.toString());
            if (from.length > 1) swap = false;
            let aW = q.artwork.width;
            let aH = q.artwork.height;
            for (let y = 0; y < aH; y++) {
                for (let x = 0; x < aW; x++) {
                    let thisPixelColor = q.artwork.artwork2D8[x][y];
                    if (from.includes(thisPixelColor)) {
                        q.artwork.artwork2D8[x][y] = to;
                    }
                    if (swap) {
                        if (thisPixelColor == to) {
                            q.artwork.artwork2D8[x][y] = from[0];
                        }
                    }
                }
            }
            this.update();
            q.artwork.render();
            q.artwork.history.record("colorChange", "artwork");
        },

        open: function(file) {
            var loadingbar = new Loadingbar("q.artwork.open", "Opening Image", true, false);
            var imageW = file.image.width;
            var imageH = file.image.height;
            var sizeLimit = 16384;
            if (imageW <= sizeLimit && imageH <= sizeLimit) {
                var idata = dataURLToImageData(file.image);
                var buffer = new Uint32Array(idata.data.buffer);
                artworkPromiseWorker.postMessage({
                    buffer: buffer,
                    width: imageW,
                    height: imageH,
                    action: "read"
                }).then(function(response) {
                    if (response) {
                        let array2D8 = bufferToArray2D8(response.buffer, response.width, response.height);
                        q.artwork.resetPalette();
                        q.artwork.set(array2D8, response.colors);
                        loadingbar.remove();
                    }
                }).catch(function(error) {
                    console.error(error);
                });
            }
        },

        process: function(effect, params) {
            let _this = this;
            var artworkBuffer = array2D8ToBuffer(this.artwork2D8);
            artworkPromiseWorker.postMessage({
                buffer: artworkBuffer,
                width: this.width,
                height: this.height,
                effect: effect,
                params: params
            }).then(function(response) {
                if (response) {
                    _this.artwork2D8 = bufferToArray2D8(response.buffer, response.width, response.height);
                    q.artwork.render();
                    q.artwork.history.record("process", "artwork");
                }
            }).catch(function(error) {
                console.error(error);
            });
        },

        colorOutline_single_pixel: function(base, outline) {

            let aW = q.artwork.width;
            let aH = q.artwork.height;
            let processArr01 = newArray2D8(aW, aH);
            for (let y = 0; y < aH; y++) {
                for (let x = 0; x < aW; x++) {
                    let prevX = x == 0 ? aW - 1 : x - 1;
                    let nextX = x == aW - 1 ? 0 : x + 1;
                    let prevPixelColor = q.artwork.artwork2D8[prevX][y];
                    let nextPixelColor = q.artwork.artwork2D8[nextX][y];
                    let thisPixelColor = q.artwork.artwork2D8[x][y];
                    if (thisPixelColor == base && prevPixelColor !== base) {
                        q.artwork.artwork2D8[prevX][y] = outline;
                    }
                    if (thisPixelColor == base && nextPixelColor !== base) {
                        q.artwork.artwork2D8[nextX][y] = outline;
                    }
                }
            }
            for (let x = 0; x < aW; x++) {
                for (let y = 0; y < aH; y++) {
                    let prevY = y == 0 ? aH - 1 : y - 1;
                    let nextY = y == aH - 1 ? 0 : y + 1;
                    let prevPixelColor = q.artwork.artwork2D8[x][prevY];
                    let nextPixelColor = q.artwork.artwork2D8[x][nextY];
                    let thisPixelColor = q.artwork.artwork2D8[x][y];
                    if (thisPixelColor == base && prevPixelColor !== base) {
                        q.artwork.artwork2D8[x][prevY] = outline;
                    }
                    if (thisPixelColor == base && nextPixelColor !== base) {
                        q.artwork.artwork2D8[x][nextY] = outline;
                    }
                }
            }
            q.artwork.render();

        },

        colorShadow: function(shadowed, shaded, shadow, range, angle) {

            shadowed = csvStringToIntArray(shadowed);
            shaded = csvStringToIntArray(shaded);
            var XShadowRange = Math.max(range, q.artwork.width);
            var YShadowRange = Math.max(range, q.artwork.height);
            var shadowPending;
            var startXFrom = 0;
            var colorListNeedsUpdate = false;

            for (var y = 0; y < q.artwork.artwork2D8[0].length; y++) {

                shadowPending = 0;
                var x = startXFrom;
                var keepLooking = true;
                var baseBeforeObject = false;
                var baseFound = false;
                var objectFound = false;
                var findObject = true;

                while (keepLooking) {

                    let thisPixelColor = q.artwork.artwork2D8[x][y];

                    objectFound = shadowed.includes(thisPixelColor);
                    baseFound = !Array.isArray(shaded) || !shaded.length || shaded.includes(thisPixelColor);

                    if (baseFound && !objectFound) baseBeforeObject = true;

                    if (findObject && objectFound) {
                        shadowPending = Number(ap.shadowRange);
                    }

                    if (baseFound && shadowPending && thisPixelColor !== shadow) {
                        q.artwork.artwork2D8[x][y] = shadow;
                    }

                    if (shadowPending) shadowPending--;
                    x++;

                    if (x >= q.artwork.width) {
                        if (shadowPending) {
                            x = 0;
                        } else {
                            keepLooking = false;
                        }
                        findObject = false;
                    }

                }

            }

            q.artwork.render();
            q.artwork.history.record("colorChange", "artwork");

        },

        set: function(arr2D8, colors32 = false, render = true) {
            if (arr2D8) {
                this.artwork2D8 = arr2D8;
                gp.autoTrim = false;
                q.graph.new(this.width, this.height);
            }
            if (colors32) {
                this.createPalette();
                colors32.forEach(function(color32, i) {
                    q.artwork.setColor(i, rgba32_hex(color32), false);
                });
                app.wins.artworkColors.domNeedsUpdate = true;
            }
            if (render) {
                q.artwork.render(10);
                XWin.render("q.artwork.set", "artworkColors");
            }
            this.history.record("q.artwork.set", "artwork", "palette");
        },

        async updateArtworkInformation() {
            let information = await this.analyseArtwork();
            Status.artworkColors(information.colorCount);
        },

        analyseArtwork: function() {
            let n = q.limits.maxArtworkColors;
            return new Promise((resolve, reject) => {
                let information = {
                    colorCount: 0,
                    counts: new Array(n).fill(0),
                    percents: new Array(n)
                };
                totalPixels = this.width * this.height;
                for (let x = this.width - 1; x >= 0; x--) {
                    for (let y = this.height - 1; y >= 0; y--) {
                        information.counts[this.artwork2D8[x][y]]++;
                    }
                }
                for (var i = n-1; i >= 0; i--) {
                    information.percents[i] = roundTo(information.counts[i] / totalPixels * 100, 2);
                    if (information.counts[i]) information.colorCount++;
                }
                resolve(information);
            });
        },

        setPointSize: function(pointW, pointH) {
            var prevPointW = this.scroll.point.w;
            var prevPointH = this.scroll.point.h;
            let maxS = q.limits.maxArtworkSize;

            q.artwork.scroll.set({
                horizontal: {
                    point: pointW,
                    content: maxS * pointW
                },
                vertical: {
                    point: pointH,
                    content: maxS * pointH
                }
            });

            let ratioX = pointW / prevPointW;
            let ratioY = pointH / prevPointH;

            let newScroll = {
                x: Math.round(q.artwork.scroll.x * ratioX),
                y: Math.round(q.artwork.scroll.y * ratioY)
            };

            // if ( zoomAt ){
            //     newGraphScroll.x = -Math.round((zoomAt.x - q.graph.scroll.x) * zoomRatio - zoomAt.x),
            //     newGraphScroll.y = -Math.round((zoomAt.y - q.graph.scroll.y) * zoomRatio - zoomAt.y)
            // }

            q.artwork.scroll.setPos(newScroll);

            q.artwork.render(10);
            app.config.save(7);

        },

        currentZoom: 0,
        minZoom: -10,
        maxZoom: 10,
        zoomValues: [1 / 24, 2 / 24, 3 / 24, 4 / 24, 6 / 24, 8 / 24, 12 / 24, 16 / 24, 18 / 24, 20 / 24, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16],
        zoom: function(amount) {
            if (!amount) {
                this.currentZoom = 0;
                this.setPointSize(1, 1);
                return;
            }
            var currentValue = this.currentZoom;
            var newValue = limitNumber(currentValue + amount, this.minZoom, this.maxZoom);
            if (currentValue !== newValue) {
                var newPointW = this.zoomValues[10 + newValue];
                var newPointH = this.zoomValues[10 + newValue];
                var renderW = newPointW * this.width;
                var renderH = newPointH * this.height;
                var minRenderW = Math.min(12, this.width);
                var minRenderH = Math.min(12, this.height);
                if (renderW >= minRenderW && renderH >= minRenderH) {
                    this.currentZoom = newValue;
                    this.setPointSize(newPointW, newPointH);
                }
            }
        },

        // q.artwork.render:
        render: function(instanceId = 0, origin = "bl") {

            // console.log(["q.artwork.render", instanceId]);

            Debug.time("q.artwork.render");

            var i, j, x, y, arrX, arrY, xTranslated, yTranslated;

            var ctx = q.context.artworkDisplay;
            if (!ctx) return;

            var ctxW = ctx.canvas.clientWidth;
            var ctxH = ctx.canvas.clientHeight;
            let pixels = q.pixels.artworkDisplay;
            let pixels8 = q.pixels8.artworkDisplay;
            let pixels32 = q.pixels32.artworkDisplay;

            var scrollX = this.scroll.x;
            var scrollY = this.scroll.y;
            var seamlessX = ap.seamlessX;
            var seamlessY = ap.seamlessY;
            var pixelW = this.scroll.point.w;
            var pixelH = this.scroll.point.h;

            Selection.get("artwork").scroll(q.artwork.scroll.x, q.artwork.scroll.y);

            var gridLight = app.ui.grid.light;
            var gridDark = app.ui.grid.dark;

            var arrW = this.width;
            var arrH = this.height;

            var unitW = Math.round(arrW * pixelW);
            var unitH = Math.round(arrH * pixelH);

            var drawW = seamlessX ? ctxW : Math.min(unitW + scrollX, ctxW);
            var drawH = seamlessY ? ctxH : Math.min(unitH + scrollY, ctxH);

            // Render Background Check
            if (drawW < ctxW || drawH < ctxH) {
                let checkLight = app.ui.check.light;
                let checkDark = app.ui.check.dark;
                let bgCheckPixelW = pixelW < 1 ? 1 : pixelW;
                let bgCheckPixelH = pixelH < 1 ? 1 : pixelH;
                for (y = 0; y < ctxH; ++y) {
                    yTranslated = ~~((y - scrollY) / bgCheckPixelH);
                    i = (ctxH - y - 1) * ctxW;
                    for (x = 0; x < ctxW; ++x) {
                        xTranslated = ~~((x - scrollX) / bgCheckPixelW);
                        pixels32[i + x] = ~~(xTranslated + yTranslated) % 2 ? checkLight : checkDark;
                    }
                }
            }

            if (is2D8(this.artwork2D8)) {

                let colors32 = this.colors32;
                let artwork8 = this.artwork8;

                // Render Artwork
                if (pixelW == 1 && pixelH == 1) {
                    for (y = 0; y < drawH; y++) {
                        arrY = loopNumber(y - scrollY, arrH);
                        i = (ctxH - y - 1) * ctxW;
                        j = arrY * arrW;
                        for (x = 0; x < drawW; x++) {
                            arrX = loopNumber(x - scrollX, arrW);
                            pixels32[i + x] = colors32[artwork8[j + arrX]];
                        }
                    }
                } else {
                    for (y = 0; y < drawH; ++y) {
                        yTranslated = (y - scrollY) / pixelH;
                        arrY = loopNumber(yTranslated, arrH);
                        i = (ctxH - y - 1) * ctxW;
                        j = arrY * arrW;
                        for (x = 0; x < drawW; ++x) {
                            xTranslated = (x - scrollX) / pixelW;
                            arrX = loopNumber(xTranslated, arrW);
                            pixels32[i + x] = colors32[artwork8[j + arrX]];
                        }
                    }
                }

                // Render Grid
                if (ap.showGrid) {
                    let hMajorEvery = ap.showMajorGrid ? ap.hMajorGridEvery : 0;
                    let vMajorEvery = ap.showMajorGrid ? ap.vMajorGridEvery : 0;
                    bufferGrid(origin, pixels8, pixels32, ctxW, ctxH, pixelW, pixelH, scrollX, scrollY, ap.showMinorGrid, vMajorEvery, hMajorEvery, gridLight, gridDark);
                }

            }

            ctx.putImageData(pixels, 0, 0);

            Debug.timeEnd("q.artwork.render", "perf");

        },

        pointColorIndex: function(mouse) {
            let aX = mouse.end - 1;
            let aY = mouse.pick - 1;
            let artworkLoaded = q.artwork.width && q.artwork.height;
            let mouseOverArtwork = artworkLoaded && isBetween(aX, 0, q.artwork.width - 1) && isBetween(aY, 0, q.artwork.height - 1);
            if (mouseOverArtwork) return q.artwork.artwork2D8[aX][aY];
            return null;
        }

    };

    function createArtworkPopups() {

        console.log("Create Artwork Popups");

        q.artwork.history = new History({
            toolbar: app.views.artwork.toolbar,
            btnUndo: "toolbar-artwork-edit-undo",
            btnRedo: "toolbar-artwork-edit-redo",
            getters: {
                get artwork() {
                    return gzip2D8(q.artwork.artwork2D8);
                },
                get palette() {
                    return JSON.stringify(q.artwork.palette);
                }
            },
            setters: {
                set artwork(data) {
                    q.artwork.artwork2D8 = ungzip2D8(data);
                },
                set palette(data) {
                    q.artwork.palette = JSON.parse(data);
                    XWin.render("q.artwork.set", "artworkColors");
                }
            },
            beforeSet: function() {},
            afterSet: function() {
                q.artwork.render();
            }
        });

        new XForm({
            toolbar: app.views.artwork.toolbar,
            button: "toolbar-artwork-view-settings",
            id: "artworkViewSettings",
            parent: "artwork",
            array: ap.viewSettings,
            type: "popup",
            title: "Artwork View Settings",
            active: true,
            onChange: function(dom, value) {
                if (dom == "artworkSeamlessX") {
                    q.artwork.render(10);

                } else if (dom == "artworkSeamlessY") {
                    q.artwork.render(10);

                } else if (dom == "artworkShowMinorGrid") {
                    q.artwork.render(10);

                } else if (dom == "artworkShowMajorGrid") {
                    q.artwork.render(10);

                } else if (dom == "artworkVMajorGridEvery") {
                    q.artwork.render(10);

                } else if (dom == "artworkHMajorGridEvery") {
                    q.artwork.render(10);

                }
            }

        });

        new XForm({
            toolbar: app.views.artwork.toolbar,
            button: "toolbar-artwork-shadow",
            id: "artworkColorShadow",
            parent: "artwork",
            array: ap.shadow,
            type: "popup",
            title: "Shadow",
            active: false,
            onShow: function() {
                var el = $("#artworkShadedColors");
                if (ap.lockShadedColors) {
                    el.closest(".xrow").show();
                } else {
                    el.closest(".xrow").hide();
                }
            },
            onChange: function(dom, value) {
                console.log([dom, value]);
                if (dom == "artworkLockShadedColors") {
                    var el = $("#artworkShadedColors");
                    if (value) {
                        el.closest(".xrow").show();
                    } else {
                        el.closest(".xrow").hide();
                    }
                }
            },
            onApply: function() {
                let shadowed = csvStringToIntArray(ap.shadowedColors).filterInRange(0, 255).join(",");
                let shaded = csvStringToIntArray(ap.shadedColors).filterInRange(0, 255).join(",");
                ap.shadowedColors = shadowed;
                ap.shadedColors = shaded;
                $("#artworkShadowedColors").val(shadowed);
                $("#artworkShadedColors").val(shaded);
                q.artwork.colorShadow(shadowed, shaded, ap.shadowColor, ap.shadowRange, ap.shadowDirection);
            }
        });

        new XForm({
            toolbar: app.views.artwork.toolbar,
            button: "toolbar-artwork-color-outline",
            id: "artworkColorOutline",
            parent: "artwork",
            array: ap.outline,
            type: "popup",
            title: "Outline",
            active: false,
            switchable: true,
            onShow: function() {

            },
            onChange: function(dom, value) {

            },
            onApply: function() {
                q.artwork.process("colorOutline", {
                    base: csvStringToIntArray(ap.outlineBaseColor),
                    outline: ap.outlineStrokeColor,
                    strokeSize: ap.outlineStrokeSize,
                    rounded: ap.outlineStrokeRounded,
                    position: ap.colorStrokePosition,
                    grouping: ap.colorStrokeGrouping
                });
            }
        });

        new XForm({
            toolbar: app.views.artwork.toolbar,
            button: "toolbar-artwork-color-change",
            id: "artworkColorChange",
            parent: "artwork",
            array: ap.colorChange,
            type: "popup",
            title: "Color Change",
            active: true,
            onShow: function() {
                if (ap.swapColors) {
                    $("#artworkFromColors").closest(".xrow").hide();
                    $("#artworkFromColor").closest(".xrow").show();
                } else {
                    $("#artworkFromColors").closest(".xrow").show();
                    $("#artworkFromColor").closest(".xrow").hide();
                }
            },
            onChange: function(dom, value) {
                if (dom == "artworkSwapColors") {
                    if (value) {
                        $("#artworkFromColors").closest(".xrow").hide();
                        $("#artworkFromColor").closest(".xrow").show();
                    } else {
                        $("#artworkFromColors").closest(".xrow").show();
                        $("#artworkFromColor").closest(".xrow").hide();
                    }
                }
            },
            onApply: function() {
                let fromColors = ap.swapColors ? $("#artworkFromColor").num() : $("#artworkFromColors").val();
                let toColor = $("#artworkToColor").num();
                q.artwork.colorChange(fromColors, toColor, ap.swapColors);
            }
        });

        new XForm({
            id: "editArtworkColor",
            position: "right",
            parent: "artwork",
            array: ap.editColor,
            type: "popup",
            button: "btn-edit-color",
            switchable: false,
            active: true,
            onReady: function() {
                console.log("Edit Artwork Color Ready");
                console.log(this.form);
            },
            onBeforeShow: function() {
                let form = this;
                let li_id = form.buttonRef;
                let cw = q.artwork.palette[li_id];
                ap.editColorCaption = "Artwork Color " + li_id;
                ap.colorWeaveColor = cw.hex;

                form.setDefault("colorWeaveColor", cw.hex);
                form.setDefault("colorWeaveOffsetX", cw.offsetx);
                form.setDefault("colorWeaveOffsetY", cw.offsety);

                if (cw.weaveIsApplied) {
                    let weave = q.graph.weaves[cw.weaveId].weave2D8;
                    let weaveW = weave.length;
                    let weaveH = weave[0].length;
                    this.setMinMax("colorWeaveOffsetX", -weaveW + 1, weaveW - 1);
                    this.setMinMax("colorWeaveOffsetY", -weaveH + 1, weaveH - 1);
                    ap.colorWeaveOffsetX = cw.offsetx;
                    ap.colorWeaveOffsetY = cw.offsety;
                } else {
                    this.setMinMax("colorWeaveOffsetX", 0, 0);
                    this.setMinMax("colorWeaveOffsetY", 0, 0);
                    ap.colorWeaveOffsetX = 0;
                    ap.colorWeaveOffsetY = 0;
                }
                this.colorIsChanged = false;
            },
            onChange: function(dom, value) {

                let doReset = false;
                var form = this;
                var li_id = form.buttonRef;
                var cw = q.artwork.palette[li_id];

                if (dom == undefined && value == undefined) {
                    doReset = true;
                }

                if (!doReset && dom.in("artworkColorWeaveOffsetX", "artworkColorWeaveOffsetY") && cw.weaveIsApplied) {
                    if (dom == "artworkColorWeaveOffsetX") cw.offsetx = value;
                    if (dom == "artworkColorWeaveOffsetY") cw.offsety = value;
                    q.artwork.applyWeaveToColor(li_id, cw.weaveId, cw.offsetx, cw.offsety);
                }

                if (!doReset && dom == "artworkColorWeaveColor") {
                    let newHex = $("#artworkColorWeaveColor").bgcolor();
                    let li = XWin.getLibraryItemDomById("artworkColors", false, li_id);
                    li.find(".img-thumb").bgcolor(newHex);
                    q.artwork.setColor(li_id, newHex, false);
                    q.artwork.render();
                    this.colorIsChanged = true;
                }

                if (doReset) {
                    q.artwork.history.off();
                    if (cw.weaveIsApplied) {
                        q.artwork.applyWeaveToColor(li_id, cw.weaveId, cw.offsetx, cw.offsety);
                    }
                    let li = XWin.getLibraryItemDomById("artworkColors", false, li_id);
                    let defaultHex = form.getItem("colorWeaveColor").defaultValue;
                    li.find(".img-thumb").bgcolor(defaultHex);
                    q.artwork.setColor(li_id, defaultHex, false);
                    q.artwork.render();
                    q.artwork.history.on();
                    this.colorIsChanged = false;
                }

            },
            onHide: function() {
                if (this.colorIsChanged) {
                    q.artwork.history.record("artworkEditColor", "palette");
                }
            }

        });

        new XForm({
            id: "resizeArtwork",
            parent: "artwork",
            array: ap.resizeArtwork,
            switchable: false,
            width: 180,
            height: 180,
            top: 100,
            right: 100,
            type: "window",
            title: "Resize Artwork",
            active: true,
            onShow: function() {
                let form = this;
                form.setDefault("resizeWidth", q.artwork.width);
                form.setDefault("resizeHeight", q.artwork.height);
                $("#artworkResizeWidth").num(q.artwork.width);
                $("#artworkResizeHeight").num(q.artwork.height);
            },
            onChange: function(dom, value) {

                let form = this;
                let cw = $("#artworkResizeWidth").num();
                let ch = $("#artworkResizeHeight").num();

                let dw = form.getDefault("resizeWidth");
                let dh = form.getDefault("resizeHeight");

                if (dom == "artworkResizeWidth" && ap.resizeMaintainRatio) {
                    let nh = Math.round(value * dh / dw);
                    $("#artworkResizeHeight").num(nh);

                } else if (dom == "artworkResizeHeight" && ap.resizeMaintainRatio) {
                    let nw = Math.round(value * dw / dh);
                    $("#artworkResizeWidth").num(nw);

                } else if (dom == "artworkResizeMaintainRatio" && ap.resizeMaintainRatio) {
                    let nh = Math.round(cw * dh / dw);
                    $("#artworkResizeHeight").num(nh);

                }

            },
            onApply: function() {
                let width = $("#artworkResizeWidth").num();
                let height = $("#artworkResizeHeight").num();
                let resizedArtwork = q.artwork.artwork2D8.transform2D8(10, "resize", width, height);
                q.artwork.set(resizedArtwork);
            }
        });

    }

    function createSimulationPopups() {

        new XForm({
            toolbar: app.views.simulation.toolbar,
            button: "toolbar-simulation-structure",
            id: "simulationStructure",
            parent: "simulation",
            array: sp.structure,
            type: "popup",
            title: "Simulation Structure",
            onShow: function() {

                let form = this;

                for (let id in q.graph.yarns) {
                    form.setSelectOption("warpYarnId", [id, q.graph.yarns[id].name]);
                    form.setSelectOption("weftYarnId", [id, q.graph.yarns[id].name]);
                }
                form.setDefault("warpYarnId", "system_0");
                form.setDefault("weftYarnId", "system_0");
                form.setItem("warpYarnId", sp.warpYanId);
                form.setItem("weftYarnId", sp.weftYanId);

                this.quickModeItems = ["warpSize", "weftSize", "warpSpace", "weftSpace"];
                this.scaledModeItems = ["yarnConfig", "warpYarnId", "weftYarnId", "warpDensity", "weftDensity", "calculateScreenDPI", "screenDPI", "zoom", "reedFill", "dentingSpace", "fuzzySurface", "renderQuality"];
                let isQuickMode = sp.mode == "quick";
                for (let item of this.quickModeItems) {
                    this.showRow(item, isQuickMode);
                }
                for (let item of this.scaledModeItems) {
                    this.showRow(item, !isQuickMode);
                }
                this.bisetItems = ["warpYarnId", "weftYarnId"];
                let isBiset = sp.yarnConfig == "biset";
                let showYarnConfigs = (!isQuickMode && isBiset);
                for (let item of this.bisetItems) {
                    this.showRow(item, showYarnConfigs);
                }

            },
            onApply: function() {
                q.simulation.render(6);
            },
            onChange: function(dom, value) {

                let form = this;

                if (dom == "simulationMode") {
                    let isQuickMode = value == "quick";
                    for (let item of this.quickModeItems) {
                        this.showRow(item, isQuickMode);
                    }
                    for (let item of this.scaledModeItems) {
                        this.showRow(item, !isQuickMode);
                    }
                    let isBiset = sp.yarnConfig == "biset";
                    let showYarnConfigs = (!isQuickMode && isBiset);
                    for (let item of this.bisetItems) {
                        this.showRow(item, showYarnConfigs);
                    }
                    if (!isQuickMode) form.setItem("yarnConfig", "biset");

                } else if (dom == "simulationYarnConfig") {
                    let isBiset = value == "biset";
                    for (let item of this.bisetItems) {
                        this.showRow(item, isBiset);
                    }

                }

            }
        });

        new XForm({
            toolbar: app.views.simulation.toolbar,
            button: "toolbar-simulation-effects",
            id: "simulationEffects",
            parent: "simulation",
            array: sp.effects,
            type: "popup",
            title: "Surface Effects",
            onShow: function() {

            },
            onApply: function() {
                q.simulation.render(6);
            },
            onChange: function(dom, value) {

            }
        });

        new XForm({
            toolbar: app.views.simulation.toolbar,
            button: "toolbar-simulation-settings",
            id: "simulationSettings",
            parent: "simulation",
            array: sp.settings,
            type: "popup",
            title: "Simulation Settings",
            onShow: function() {

            },
            onApply: function() {
                q.simulation.render(6);
            },
            onChange: function(dom, value) {

            }
        });

        new XForm({
            toolbar: app.views.simulation.toolbar,
            button: "toolbar-simulation-yarn",
            id: "simulationYarn",
            parent: "simulation",
            array: sp.yarn,
            type: "popup",
            title: "Yarn Properties",
            onApply: function() {
                q.simulation.render(6);
            }
        });
        new XForm({
            toolbar: app.views.simulation.toolbar,
            button: "toolbar-simulation-behaviour",
            id: "simulationBehaviour",
            parent: "simulation",
            array: sp.behaviour,
            type: "popup",
            title: "Behaviour",
            onApply: function() {
                q.simulation.render(6);
            }
        });

        new XForm({
            id: "exportSimulationAsImage",
            parent: "simulation",
            array: sp.export,
            switchable: false,
            width: 210,
            height: 360,
            top: 160,
            right: 500,
            type: "window",
            title: "Export Simulation",

            onReady: function() {

            },

            onShow: function() {
                $("#simulationExportXRepeats").num(1);
                $("#simulationExportYRepeats").num(1);
                this.onChange("simulationExportXRepeats");
                this.onChange("simulationExportYRepeats");
            },

            onChange: function(dom) {

                let formInputDomIds = {
                    rx: "simulationExportXRepeats",
                    ry: "simulationExportYRepeats",
                    tx: "simulationExportWarpThreads",
                    ty: "simulationExportWeftThreads",
                    px: "simulationExportRenderWidth",
                    py: "simulationExportRenderHeight",
                    dx: "simulationExportXDimension",
                    dy: "simulationExportYDimension",
                    es: "simulationExportScale",
                    eq: "simulationExportQuality",
                    ex: "simulationExportOutputWidth",
                    ey: "simulationExportOutputHeight"
                };

                let e = {};
                let v = {};
                let is = {};

                for (let domId in formInputDomIds) {
                    e[domId] = $("#" + formInputDomIds[domId]);
                    v[domId] = e[domId].num();
                    is[domId] = formInputDomIds[domId] == dom;
                }

                let isX = is.rx || is.tx || is.dx || is.px;
                let isY = is.ry || is.ty || is.dy || is.py;

                if (isX) {
                    if (is.rx) v.tx = v.rx * q.graph.colorRepeat.warp;
                    if (is.dx) v.tx = v.dx / q.simulation.intersection.width.mm;
                    if (is.px) v.tx = v.px / q.simulation.intersection.width.px;

                    if (!is.tx) e.tx.num(v.tx, 1);
                    if (!is.rx) e.rx.num(v.tx / q.graph.colorRepeat.warp, 2);
                    if (!is.dx) e.dx.num(v.tx * q.simulation.intersection.width.mm, 1);
                    if (!is.px) e.px.num(v.tx * q.simulation.intersection.width.px, 0);
                    e.ex.num(v.tx * q.simulation.intersection.width.px, 0);
                }

                if (isY) {
                    if (is.ry) v.ty = v.ry * q.graph.colorRepeat.weft;
                    if (is.dy) v.ty = v.dy / q.simulation.intersection.height.mm;
                    if (is.py) v.ty = v.py / q.simulation.intersection.height.px;

                    if (!is.ty) e.ty.num(v.ty, 1);
                    if (!is.ry) e.ry.num(v.ty / q.graph.colorRepeat.weft, 2);
                    if (!is.dy) e.dy.num(v.ty * q.simulation.intersection.height.mm, 1);
                    if (!is.py) e.py.num(v.ty * q.simulation.intersection.height.px, 0);
                    e.ey.num(v.ty * q.simulation.intersection.height.px, 0);
                }
            },

            onApply: function() {
                let renderW = $("#simulationExportRenderWidth").num();
                let renderH = $("#simulationExportRenderHeight").num();
                let exportW = $("#simulationExportOutputWidth").num();
                let exportH = $("#simulationExportOutputHeight").num();
                let frame = ev("#simulationExportInfoFrame");
                q.simulation.renderToExport(renderW, renderH, exportW, exportH, frame);
            }

        });

    }

    function createThreePopups() {

        new XForm({
            toolbar: app.views.three.toolbar,
            button: "toolbar-three-scene",
            id: "threeScene",
            parent: "three",
            array: tp.scene,
            type: "popup",
            title: "Scene",
            active: true,
            onChange: function(dom) {

                if (dom == undefined || dom == "threeCastShadow") {
                    q.three.applyShadowSetting();
                }

                if (dom == undefined || dom == "threeBgType" || dom == "threeBgColor") {
                    q.three.setBackground();
                }

                if (dom == undefined || dom == "threeProjection") {
                    q.three.swithCameraTo(tp.projection);
                }

                if (dom == undefined || dom == "threeShowAxes") {
                    q.three.axes.visible = tp.showAxes;
                    q.three.rotationAxisLine.visible = tp.showAxes;
                    q.three.render();
                }

                if (dom == undefined || dom == "threeMouseHoverOutline") {
                    q.three.outlinePass.clear(true);
                }

                if (dom == undefined || dom.in("threeLightTemperature", "threeLightsIntensity")) {
                    q.three.setLights();
                }

            }

        });

        new XForm({
            toolbar: app.views.three.toolbar,
            button: "toolbar-three-filters",
            id: "threeFilters",
            parent: "three",
            array: tp.filters,
            type: "popup",
            title: "Filters",
            onShow: function() {
                var el = $("#threeHiddenColors");
                if (tp.hideColors) {
                    el.val(tp.hiddenColors);
                    el.closest(".xrow").show();
                } else {
                    el.closest(".xrow").hide();
                }
            },
            onApply: function() {
                var hiddenColors = $("#threeHiddenColors").val().replace(/[^A-Za-z]/g, "").split("").unique().join("");
                ap.hiddenColors = hiddenColors;
                $("#threeHiddenColors").val(hiddenColors);
                globalThree.buildFabric();
            },
            onChange: function(dom) {

                var el;

                if (dom == "threeHideColors") {

                    el = $("#threeHiddenColors");
                    if (tp.hideColors) {
                        el.val("");
                        el.closest(".xrow").show();
                    } else {
                        el.closest(".xrow").hide();
                    }

                }

            }

        });

        new XForm({
            toolbar: app.views.three.toolbar,
            button: "toolbar-three-structure",
            id: "threeStructure",
            parent: "three",
            array: tp.structure,
            type: "popup",
            title: "Fabric Structure",
            onShow: function() {

                let form = this;

                for (let id in q.graph.yarns) {
                    form.setSelectOption("warpYarnId", [id, q.graph.yarns[id].name]);
                    form.setSelectOption("weftYarnId", [id, q.graph.yarns[id].name]);
                }
                form.setDefault("warpYarnId", "system_0");
                form.setDefault("weftYarnId", "system_0");
                form.setItem("warpYarnId", tp.warpYanId);
                form.setItem("weftYarnId", tp.weftYanId);

                let ifBiset = tp.yarnConfig == "biset";
                form.showRow("warpYarnId", ifBiset);
                form.showRow("weftYarnId", ifBiset);

            },
            onApply: function() {
                globalThree.buildFabric();
            },
            
            onChange: function(dom, value) {

                console.log(dom);

                if (dom == "threeYarnConfig") {
                    let ifBiset = value == "biset";
                    this.showRow("warpYarnId", ifBiset);
                    this.showRow("weftYarnId", ifBiset);

                } else if (dom == "threeLayerStructure") {
                    this.showRow("layerStructurePattern", value, tp.layerStructurePattern);
                    this.showRow("layerDistance", value, tp.layerDistance);

                }

            }
        });

        new XForm({
            toolbar: app.views.three.toolbar,
            button: "toolbar-three-render-settings",
            id: "threeRender",
            parent: "three",
            array: tp.render,
            type: "popup",
            onApply: function() {
                globalThree.buildFabric();
            }
        });

    }

    function createModelPopups() {

        new XForm({
            toolbar: app.views.model.toolbar,
            button: "toolbar-model-scene",
            id: "modelScene",
            parent: "model",
            array: mp.scene,
            type: "popup",
            active: true,
            onChange: function(dom) {
                console.log(["onChange", dom]);

                if (dom == "modelBgType" || dom == "modelBgColor") {
                    q.model.setBackground();

                } else if (dom == "modelFogColor") {
                    q.model.scene.fog.color = new THREE.Color(mp.fogColor);
                    q.model.needsUpdate = true;

                } else if (dom == "modelFogDensity") {
                    q.model.scene.fog.density = mp.fogDensity * 0.05;
                    q.model.needsUpdate = true;

                } else {
                    q.model.setEnvironment();
                }

            }
        });

        new XForm({
            toolbar: app.views.model.toolbar,
            button: "toolbar-model-lights",
            id: "modelLights",
            parent: "model",
            array: mp.lights,
            type: "popup",
            switchable: false,
            active: true,
            onReady: function() {

            },
            onChange: function(dom) {
                q.model.camera.focus = mp.cameraFocus;
                q.model.setLights();
            },
            onReset: function() {
                q.model.setLights();
            }
        });

        new XForm({
            title: "View Settings",
            toolbar: app.views.model.toolbar,
            button: "toolbar-model-view",
            id: "modelView",
            parent: "model",
            array: mp.view,
            type: "popup",
            switchable: true,
            active: true,
            onBeforeShow: function() {
                var form = this;
                form.setMinMax("objectY", 0, mp.roomH);
                form.setMinMax("cameraX", -mp.roomW / 2, mp.roomW / 2);
                form.setMinMax("cameraY", 0, mp.roomH);
                form.setMinMax("cameraZ", 0, mp.roomW / 2);
                form.setMinMax("targetX", -mp.roomW / 2, mp.roomW / 2);
                form.setMinMax("targetY", 0, mp.roomH);
                form.setMinMax("targetZ", 0, mp.roomW / 2);
                mp.objectY = roundTo(q.model.model.position.y, 1);
                mp.cameraX = roundTo(q.model.camera.position.x, 1);
                mp.cameraY = roundTo(q.model.camera.position.y, 1);
                mp.cameraZ = roundTo(q.model.camera.position.z, 1);
                mp.targetX = roundTo(q.model.controls.target.x, 1);
                mp.targetY = roundTo(q.model.controls.target.y, 1);
                mp.targetZ = roundTo(q.model.controls.target.z, 1);
            },
            onChange: function(dom) {
                let pos = q.model.model.position.clone();
                q.model.model.position.set(pos.x, mp.objectY, pos.z);
                q.model.camera.position.set(mp.cameraX, mp.cameraY, mp.cameraZ);
                q.model.controls.target.set(mp.targetX, mp.targetY, mp.targetZ);
                q.model.controls.update();
                q.model.needsUpdate = true;
            },
            onReset: function() {

            }
        });

        new XForm({
            toolbar: app.views.model.toolbar,
            button: "toolbar-model-effects",
            id: "modelEffects",
            parent: "model",
            array: mp.effects,
            type: "popup",
            title: "Effects",
            switchable: false,
            active: true,
            onReady: function() {

            },
            onReset: function() {

            },
            onChange: function(dom) {

                if (mp.effectBokeh) {
                    q.model.bokehPass.enabled = true;
                    q.model.bokehPass.uniforms.focus.value = mp.effectBokehFocus;
                    q.model.bokehPass.uniforms.aperture.value = mp.effectBokehAperture * 0.00001;
                    q.model.bokehPass.uniforms.maxblur.value = mp.effectBokehMaxBlur;
                } else {
                    q.model.bokehPass.enabled = false;
                }

                // if ( mp.effectSSAO ){
                // 	q.model.ssaoPass.enabled = true;
                // 	q.model.ssaoPass.kernelRadius = mp.effectSSAOKernelRadius;
                // 	q.model.ssaoPass.minDistance = mp.effectSSAOMinDistance;
                // 	q.model.ssaoPass.maxDistance = mp.effectSSAOMaxDistance;
                // } else {
                // 	q.model.ssaoPass.enabled = false;
                // }

                // if ( mp.effectSAO ){
                // 	q.model.saoPass.enabled = true;
                // 	q.model.saoPass.params.saoBias = mp.effectSAOBias;
                // 	q.model.saoPass.params.saoIntensity = mp.effectSAOIntensity;
                // 	q.model.saoPass.params.saoScale = mp.effectSAOScale;

                // 	q.model.saoPass.params.saoKernelRadius = mp.effectSAOKernelRadius;
                // 	q.model.saoPass.params.saoMinResolution = mp.effectSAOMinResolution;
                // 	q.model.saoPass.params.saoBlur = mp.effectSAOBlur;

                // 	q.model.saoPass.params.saoBlurRadius = mp.effectSAOBlurRadius;
                // 	q.model.saoPass.params.saoBlurStdDev = mp.effectSAOBlurStdDev;
                // 	q.model.saoPass.params.saoBlurDepthCutoff = mp.effectSAOBlurDepthCutoff;
                // } else {
                // 	q.model.saoPass.enabled = true;
                // }

                q.model.composerSetup();

                q.model.needsUpdate = true;
            }

        });

        new XForm({
            id: "modelMaterialProps",
            position: "right",
            parent: "model",
            array: mp.materialProps,
            type: "popup",
            title: "Material Properties",
            switchable: false,
            button: "btn-edit-material",
            onBeforeShow: function() {
                var form = this;
                var mat_id = form.buttonRef;
                var mat = q.model.materials[mat_id];
                mp.materialSelectedId = mat_id;
                mp.materialMapWidth = roundTo(mat.map_width, 2);
                mp.materialMapHeight = roundTo(mat.map_height, 2);
                mp.materialMapOffsetX = roundTo(mat.map_offsetx, 2);
                mp.materialMapOffsetY = roundTo(mat.map_offsety, 2);
                mp.materialMapRotationDeg = roundTo(mat.map_rotationdeg, 2);
                mp.materialMapUnit = mat.map_unit;
                form.setDefault("materialMapWidth", roundTo(mat.map_width_default, 2));
                form.setDefault("materialMapHeight", roundTo(mat.map_height_default, 2));
                form.setDefault("materialMapOffsetX", 0);
                form.setDefault("materialMapOffsetY", 0);
                form.setDefault("materialMapUnit", "mm");
                form.setDefault("materialMapRotationDeg", 0);
            },
            onShow: function() {
                mp.materialPropsCurrentUnit = ev("#modelMaterialMapUnit");
            },
            onReady: function() {

            },
            onApply: function() {
                var form = this;
                var mat_id = form.buttonRef;
                var mat = q.model.materials[mat_id];

                var bump = mp.materialBumpMap;
                q.model.setMaterial(mat_id, {
                    map_width: mp.materialMapWidth,
                    map_height: mp.materialMapHeight,
                    map_offsetx: mp.materialMapOffsetX,
                    map_offsety: mp.materialMapOffsetY,
                    map_unit: mp.materialMapUnit,
                    map_rotationdeg: mp.materialMapRotationDeg,
                    bumpMap: "canvas_bump",
                    color: mp.textureColor
                });

                var map_width_px = 1;
                var map_height_px = 1;
            },

            onChange: function(dom) {

                console.log(dom);

                if (dom == "modelMaterialMapUnit") {
                    var pUnit = mp.materialPropsCurrentUnit;
                    var nUnit = ev("#modelMaterialMapUnit");
                    var multi = 1;
                    if (pUnit == "mm") multi = lookup(nUnit, ["cm", "inch"], [1 / 10, 1 / 25.4]);
                    if (pUnit == "cm") multi = lookup(nUnit, ["mm", "inch"], [10, 1 / 2.54]);
                    if (pUnit == "inch") multi = lookup(nUnit, ["mm", "cm"], [25.4, 2.54]);
                    var pWidth = $("#modelMaterialMapWidth").num();
                    var pHeight = $("#modelMaterialMapHeight").num();
                    var pOffsetX = $("#modelMaterialMapOffsetX").num();
                    var pOffsetY = $("#modelMaterialMapOffsetY").num();
                    var newWidth = roundTo(pWidth * multi, 2);
                    var newHeight = roundTo(pHeight * multi, 2);
                    var newOffsetX = roundTo(pOffsetX * multi, 2);
                    var newOffsetY = roundTo(pOffsetY * multi, 2);
                    $("#modelMaterialMapWidth").num(newWidth);
                    $("#modelMaterialMapHeight").num(newHeight);
                    $("#modelMaterialMapOffsetX").num(newOffsetX);
                    $("#modelMaterialMapOffsetY").num(newOffsetY);
                    mp.materialPropsCurrentUnit = nUnit;
                }

            }
        });

    }

    function createGraphPopups() {

        console.log("Create Graph Popups");

        new XForm({
            id: "graphTestForm",
            title: "Graph Test Form",
            toolbar: app.views.graph.toolbar,
            button: "toolbar-testForm",
            parent: "graph",
            type: "popup",
            active: false,
            array: gp.testForm,
            switchable: true,
            resetable: true,
            autoClose: true,
            onReady: function() {
                // console.log("onReady");
            },
            onShow: function() {
                // console.log("onShow");
            },
            onSave: function() {
                // console.log("onSave");
            },
            onApply: function() {
                // console.log("onApply");
            },
            onReset: function() {
                // console.log("onReset");
            },
            onChange: function(param, value) {
                // console.log("onChange", param, value);
            },
            onHide: function() {
                // console.log("onHide");
            }
        });

        new XForm({
            id: "graphColorProps",
            position: "bottom",
            parent: "graph",
            array: gp.colorProps,
            type: "popup",
            button: "palette-chip-active",
            event: "dblclick",
            active: true,
            onShow: function() {
                let form = this;
                let code = form.buttonRef;
                let color = q.palette.colors[code];
                form.setItem("colorPropsTitle", "Color " + code, false, false);
                for (let id in q.graph.yarns) {
                    form.setSelectOption("colorPropsYarnId", [id, q.graph.yarns[id].name]);
                }
                q.palette.chipColorBeforeChange = [code, color.hex];
                let yarnId = q.graph.yarns?.[color.yarnId] ? color.yarnId : "system_0";
                $("#graphColorPropsHex").attr("data-code", code).bgcolor(color.hex);
                $("#graphColorPropsName").val(color.name);
                $("#graphColorPropsYarnId").val(yarnId);
                form.setDefault("colorPropsYarnId", "system_0");
                form.setDefault("colorPropsHex", color.hex);
                form.setDefault("colorPropsName", "Color " + code);
            },
            onSave: function() {
                var form = this;
                var code = form.buttonRef;
                q.palette.setChip({
                    code: code,
                    yarnId: form.getVal("colorPropsYarnId"),
                    hex: form.getVal("colorPropsHex"),
                    name: form.getVal("colorPropsName")
                });
                q.pattern.needsUpdate(6);
                q.graph.needsUpdate(8, "weave");
                app.history.record("colorProps", "palette");
                q.palette.chipColorBeforeChange = undefined;
            },
            onChange: function(dom, value) {
                let form = this;
                if (dom == "graphColorPropsHex") {
                    let code = form.buttonRef;
                    q.palette.setChip({
                        code: code,
                        hex: form.getVal("colorPropsHex"),
                    });
                    q.pattern.needsUpdate(6);
                    q.graph.needsUpdate(8, "weave");
                }
            },
            onReset: function() {
                let form = this;
            },
            onHide: function() {
                let prevColor = q.palette.chipColorBeforeChange;
                if (prevColor !== undefined) {
                    q.palette.setChip({
                        code: prevColor[0],
                        hex: prevColor[1]
                    });
                    q.palette.chipColorBeforeChange = undefined;
                }
                q.pattern.needsUpdate(6);
                q.graph.needsUpdate(8, "weave");
            }
        });

        new XForm({
            id: "graphShift",
            toolbar: app.views.graph.toolbar,
            button: "toolbar-graph-weave-shift",
            css: "popup-control9",
            parent: "graph",
            array: gp.graphShift,
            type: "popup",
            active: true,
            onBeforeShow: function() {
                let select = $("#graphShiftTarget");
                select.empty().append('<option value="weave">Weave</option>');
                if (q.graph.liftingMode == "weave") {
                    select.attr('disabled', 'disabled');
                } else {
                    select.removeAttr('disabled');
                    select
                        .append('<option value="threading">Threading</option>')
                        .append('<option value="lifting">Lifting</option>');
                }
                if (q.graph.liftingMode == "treadling") {
                    select.append('<option value="tieup">Tieup</option>');
                }
                select.val("weave").change();
            },
            onReady: function() {
                var form = this;
                $("#control9").clone().attr("id", "graphWeaveShiftFormControl9").appendTo(form.dom);
                form.dom.find(".c9-btn").click(function(e) {
                    if (e.which === 1) {
                        var graph = gp.shiftTarget;
                        var amt = form.dom.find(".c9-input").num();
                        var btn = $(this).attr("data-btn");
                        var args;
                        if (btn == "ml") args = ["shiftx", -amt];
                        else if (btn == "mr") args = ["shiftx", amt];
                        else if (btn == "tc") args = ["shifty", amt];
                        else if (btn == "bc") args = ["shifty", -amt];
                        else if (btn == "tl") args = ["shiftxy", -amt, amt];
                        else if (btn == "tr") args = ["shiftxy", amt, amt];
                        else if (btn == "bl") args = ["shiftxy", -amt, -amt];
                        else if (btn == "br") args = ["shiftxy", amt, -amt];
                        modify2D8(graph, ...args);
                    }
                    return false;
                });
            }
        });

        new XForm({
            id: "graphPatternShift",
            toolbar: app.views.graph.toolbar,
            button: "toolbar-graph-pattern-shift",
            css: "popup-control9",
            type: "popup",
            onReady: function() {
                var form = this;
                $("#control9").clone().attr("id", "graphPatternShiftFormControl9").appendTo(form.dom);
                form.dom.find(".c9-btn").click(function(e) {
                    if (e.which === 1) {
                        var amt = form.dom.find(".c9-input").num();
                        var btn = $(this).attr("data-btn");
                        var dir;
                        if (btn == "ml") dir = "left";
                        else if (btn == "mr") dir = "right";
                        else if (btn == "tc") dir = "up";
                        else if (btn == "bc") dir = "down";
                        else if (btn == "tl") dir = "up left";
                        else if (btn == "tr") dir = "up right";
                        else if (btn == "bl") dir = "down left";
                        else if (btn == "br") dir = "down right";
                        q.pattern.shift(dir, amt);
                    }
                    return false;
                });
            }
        });

        new XForm({
            id: "graphStripeResize",
            parent: "graph",
            array: gp.stripeResize,
            type: "window",
            title: "Resize Stripe",
            width: 180,
            height: 120,
            active: true,
            onShow: function() {
                var yarnSet = q.pattern.rightClick.yarnSet;
                var threadNum = q.pattern.rightClick.threadNum;
                var stripe = q.pattern.stripeAt(yarnSet, threadNum - 1);
                var maxStripeSize = q.limits.maxPatternSize - q.pattern[yarnSet].length + stripe.size;
                gp.stripeResizeStartAt = stripe.start;
                gp.stripeResizeYarnSet = yarnSet;
                gp.stripeResizePatternCopy = q.pattern[yarnSet].slice();
                this.setItem("stripeResizeNewSize", stripe.size, false, true);
                this.setItem("stripeResizeStripeNo", stripe.index + 1, false, false);
                this.setDefault("stripeResizeNewSize", stripe.size);
                this.setDefault("stripeResizeStripeNo", stripe.index + 1);
                this.setMinMax("stripeResizeNewSize", 1, maxStripeSize);
            },
            onApply: function() {
                console.log("onApply");
                var yarnSet = gp.stripeResizeYarnSet;
                var newStripeSize = gp.stripeResizeNewSize;
                var stripe = q.pattern.stripeAt(yarnSet, gp.stripeResizeStartAt);
                if (newStripeSize !== stripe.size) {
                    q.pattern.delete(yarnSet, stripe.start, stripe.end);
                    q.pattern.insert(yarnSet, stripe.val, stripe.start, newStripeSize);
                }
                gp.stripeResizePatternCopy = q.pattern[yarnSet].slice();
                app.history.record("stripeResize", yarnSet);
            },
            onChange: function(dom, value) {
                app.history.off();
                let yarnSet = gp.stripeResizeYarnSet;
                if (dom == "graphStripeResizeNewSize" && gp.stripeResizePreview) {
                    let newStripeSize = value;
                    let stripe = q.pattern.stripeAt(yarnSet, gp.stripeResizeStartAt);
                    if (newStripeSize !== stripe.size) {
                        q.pattern.delete(yarnSet, stripe.start, stripe.end);
                        q.pattern.insert(yarnSet, stripe.val, stripe.start, newStripeSize);
                    }
                } else if (dom == "graphStripeResizePreview" && !value) {
                    q.pattern[yarnSet] = gp.stripeResizePatternCopy;
                    q.graph.needsUpdate();
                    q.pattern.needsUpdate();
                } else if (dom == "graphStripeResizePreview" && value) {
                    let newStripeSize = gp.stripeResizeNewSize;
                    let stripe = q.pattern.stripeAt(yarnSet, gp.stripeResizeStartAt);
                    if (newStripeSize !== stripe.size) {
                        q.pattern.delete(yarnSet, stripe.start, stripe.end);
                        q.pattern.insert(yarnSet, stripe.val, stripe.start, newStripeSize);
                    }
                }
                app.history.on();
            },
            onHide: function() {
                app.history.off();
                q.pattern[gp.stripeResizeYarnSet] = gp.stripeResizePatternCopy;
                q.graph.needsUpdate();
                q.pattern.needsUpdate();
                app.history.on();
            }
        });

        new XForm({
            id: "graphAutoWeave",
            toolbar: app.views.graph.toolbar,
            button: "toolbar-graph-auto-weave",
            parent: "graph",
            array: gp.autoWeave,
            type: "window",
            title: "Auto Weave",
            width: 240,
            height: 383,
            active: true,
            onShow: function() {
                this.showRow("autoWeaveHeight", !gp.autoWeaveSquare);
            },
            onApply: function() {
                autoWeave();
            },
            onChange: function(dom, value) {
                if (dom == "graphAutoWeaveSquare") {
                    this.showRow("autoWeaveHeight", !value, $("#graphAutoWeaveWidth").num());
                }
            }
        });

        new XForm({
            id: "newYarn",
            toolbar: app.views.graph.toolbar,
            parent: "graph",
            array: gp.newYarn,
            type: "window",
            title: "Create New Yarn",
            height: 383,
            onShow: function() {
                let form = this;
                form.reset(true, true);
                this.imperfectionItems = ["newYarnThins", "newYarnThicks", "newYarnNeps", "newYarnNumberVariation", "newYarnUneveness"];
                this.slubItems = ["newYarnMinSlubLen", "newYarnMaxSlubLen", "newYarnMinSlubPause", "newYarnMaxSlubPause", "newYarnMinSlubThickness", "newYarnMaxSlubThickness"];
            },
            onApply: function() {
                let newYarn = {
                    name: gp.newYarnName,
                    number: gp.newYarnNumber,
                    number_system: gp.newYarnNumberSystem,
                    luster: gp.newYarnLuster,
                    shadow: gp.newYarnShadow,
                    profile: gp.newYarnProfile,
                    structure: gp.newYarnStructure,
                    imperfections: gp.newYarnImperfections,
                    slub: gp.newYarnSlub,
                    thins: gp.newYarnThins,
                    thicks: gp.newYarnThicks,
                    neps: gp.newYarnNeps,
                    min_slub: gp.newYarnMinSlubLen,
                    max_slub: gp.newYarnMaxSlubLen,
                    min_pause: gp.newYarnMinSlubPause,
                    max_pause: gp.newYarnMaxSlubPause,
                    min_thickness: gp.newYarnMinSlubThickness,
                    max_thickness: gp.newYarnMaxSlubThickness,
                    number_variation: gp.newYarnNumberVariation,
                    uneveness: gp.newYarnUneveness
                };
                app.wins.yarns.addItem("user", newYarn);
                XWin.hide("newYarn");
                XWin.show("yarns.user");
            },
            onChange: function(dom, value) {

                let form = this;

                if (dom == "graphNewYarnProfile") {
                    let isCircular = value == "circular";
                    form.showRow("newYarnAspect", !isCircular, 1);
                    form.disable("newYarnStructure", !isCircular, "mono");

                } else if (dom == "graphNewYarnImperfections") {
                    this.imperfectionItems.forEach(function(v) {
                        form.showRow(v, value);
                    });

                } else if (dom == "graphNewYarnSlub") {
                    this.slubItems.forEach(function(v) {
                        form.showRow(v, value);
                    });
                }

            }
        });

        new XForm({
            id: "editYarn",
            toolbar: app.views.graph.toolbar,
            parent: "graph",
            array: gp.editYarn,
            type: "window",
            title: "New Yarn",
            height: 383,
            active: true,
            onReady: function() {
                console.log("Edit Yarn");
                console.log(this.form);
            },
            onShow: function(params) {
                let form = this;
                let yarnId = params?.id;
                let yarn = q.graph.yarns[yarnId];
                this.yarnId = yarnId;
                form.setTitle("Edit Yarn : " + toTitleCase(yarn.tab) + " " + yarn.index);
                form.setItem("editYarnName", yarn.name, false);
                form.setItem("editYarnNumber", yarn.number, false);
                form.setItem("editYarnNumberSystem", yarn.number_system, false);
                form.setItem("editYarnLuster", yarn.luster, false);
                form.setItem("editYarnShadow", yarn.shadow, false);
                form.setItem("editYarnProfile", yarn.profile, false);
                form.setItem("editYarnAspect", yarn.profile_aspect, false);
                form.setItem("editYarnStructure", yarn.structure, false);
                form.setItem("editYarnImperfections", yarn.imperfections, false);
                form.setItem("editYarnSlub", yarn.slub, false);
                form.setItem("editYarnThins", yarn.thins, false);
                form.setItem("editYarnThicks", yarn.thicks, false);
                form.setItem("editYarnNeps", yarn.neps, false);
                form.setItem("editYarnMinSlubLen", yarn.min_slub, false);
                form.setItem("editYarnMaxSlubLen", yarn.max_slub, false);
                form.setItem("editYarnMinSlubPause", yarn.min_pause, false);
                form.setItem("editYarnMaxSlubPause", yarn.max_pause, false);
                form.setItem("editYarnMinSlubThickness", yarn.min_thickness, false);
                form.setItem("editYarnMaxSlubThickness", yarn.max_thickness, false);
                form.setItem("editYarnNumberVariation", yarn.number_variation, false);
                form.setItem("editYarnUneveness", yarn.uneveness, false);

                let isCircular = yarn.profile == "circular";
                form.showRow("editYarnAspect", !isCircular, 1);
                form.disable("editYarnStructure", !isCircular, "mono");

                this.imperfectionItems = ["editYarnThins", "editYarnThicks", "editYarnNeps", "editYarnNumberVariation", "editYarnUneveness"];
                this.imperfectionItems.forEach(function(v) {
                    form.showRow(v, gp.editYarnImperfections);
                });
                this.slubItems = ["editYarnMinSlubLen", "editYarnMaxSlubLen", "editYarnMinSlubPause", "editYarnMaxSlubPause", "editYarnMinSlubThickness", "editYarnMaxSlubThickness"];
                this.slubItems.forEach(function(v) {
                    form.showRow(v, gp.editYarnSlub);
                });

            },
            onSave: function() {
                let editYarn = {
                    id: this.yarnId,
                    name: gp.editYarnName,
                    number: gp.editYarnNumber,
                    number_system: gp.editYarnNumberSystem,
                    luster: gp.editYarnLuster,
                    shadow: gp.editYarnShadow,
                    profile: gp.editYarnProfile,
                    structure: gp.editYarnStructure,
                    imperfections: gp.editYarnImperfections,
                    slub: gp.editYarnSlub,
                    thins: gp.editYarnThins,
                    thicks: gp.editYarnThicks,
                    neps: gp.editYarnNeps,
                    min_slub: gp.editYarnMinSlubLen,
                    max_slub: gp.editYarnMaxSlubLen,
                    min_pause: gp.editYarnMinSlubPause,
                    max_pause: gp.editYarnMaxSlubPause,
                    min_thickness: gp.editYarnMinSlubThickness,
                    max_thickness: gp.editYarnMaxSlubThickness,
                    number_variation: gp.editYarnNumberVariation,
                    uneveness: gp.editYarnUneveness
                };
                app.wins.yarns.addItem("user", editYarn);
                app.wins.yarns.tabs.user.domNeedsUpdate = true;
                XWin.render("onEditYarnSave", "yarns", "user");

            },
            onChange: function(dom, value) {

                let form = this;

                if (dom == "graphEditYarnProfile") {
                    let isCircular = value == "circular";
                    form.showRow("editYarnAspect", !isCircular, 1);
                    form.disable("editYarnStructure", !isCircular, "mono");

                } else if (dom == "graphEditYarnImperfections") {
                    this.imperfectionItems.forEach(function(v) {
                        form.showRow(v, value);
                    });

                } else if (dom == "graphEditYarnSlub") {
                    this.slubItems.forEach(function(v) {
                        form.showRow(v, gp.editYarnSlub);
                    });
                }

            }
        });

        new XForm({
            id: "graphAutoPattern",
            toolbar: app.views.graph.toolbar,
            button: "toolbar-graph-auto-pattern",
            parent: "graph",
            array: gp.autoPattern,
            type: "popup",
            title: "Auto Pattern",
            onShow: function() {
                this.showRow("autoPatternLockedColors", gp.autoPatternLockColors, gp.autoPatternLockedColors);
            },
            onApply: function() {
                var lockedColors = $("#graphAutoPatternLockedColors").val().replace(/[^A-Za-z]/g, "").split("").unique().join("");
                gp.autoPatternLockedColors = lockedColors;
                $("#graphAutoPatternLockedColors").val(lockedColors);
                app.history.off();
                autoPattern();
                app.history.on();
                app.history.record("onAutoPattern", "warp", "weft");
                q.graph.needsUpdate(1, "weave");
            },
            onChange: function(dom, value) {
                if (dom == "graphAutoPatternLockColors") {
                    this.showRow("autoPatternLockedColors", value, q.pattern.colors("fabric").join(""));

                }
            }
        });

        new XForm({
            id: "graphHarnessCastout",
            parent: "graph",
            type: "window",
            title: "Harness Castout",
            array: gp.harnessCastout,
            onShow: function() {

            },
            onApply: function() {
                var castoutPattern = $("#graphCastoutPattern").val();
                var castoutWeave = q.graph.weave2D8.transform2D8(10, "castout", castoutPattern);
                q.graph.set(0, "weave", castoutWeave);

            }
        });

        new XForm({
            id: "graphWeaveTools",
            parent: "graph",
            toolbar: app.views.graph.toolbar,
            button: "toolbar-graph-weave-tools",
            type: "popup",
            title: "Weave Tools",
            array: gp.weaveTools,
            active: true,
            onShow: function() {},
            onChange: function(dom, value) {
                console.log(dom, value);
                if (dom == 'graphWeaveToolsShuffleEnds') {
                    modify2D8("weave", "shuffle_ends");
                }
            },
            onApply: function() {},
            onHide: function() {}
        });

        new XForm({
            id: "graphWeaveRepeat",
            parent: "graph",
            toolbar: app.views.graph.toolbar,
            button: "toolbar-graph-weave-repeat",
            type: "popup",
            title: "Weave Repeat",
            array: gp.weaveRepeat,
            active: true,
            onShow: function() {
                this.reset(false, true);
                this.setItem("weaveRepeatXRepeats", 1, false, true);
                this.setItem("weaveRepeatYRepeats", 1, false, true);
                $("#graphWeaveRepeatXRepeats").closest(".xrow").show();
                $("#graphWeaveRepeatYRepeats").closest(".xrow").show();
                $("#graphWeaveRepeatShift").closest(".xrow").hide();
                this.weaveCopyForRepeating = q.graph.weave2D8.clone2D8();
                this.onChange();
            },
            onChange: function(dom, value) {
                app.history.off();
                let modifiedWeave;
                if (dom == "graphWeaveRepeatType") {
                    this.setItem("weaveRepeatXRepeats", 2, false, true);
                    this.setItem("weaveRepeatYRepeats", 2, false, true);
                    $("#graphWeaveRepeatYRepeats").num(2);
                    if (value == "block") {
                        $("#graphWeaveRepeatXRepeats").closest(".xrow").show();
                        $("#graphWeaveRepeatYRepeats").closest(".xrow").show();
                        $("#graphWeaveRepeatShift").closest(".xrow").hide();
                    } else if (value == "drop") {
                        $("#graphWeaveRepeatXRepeats").closest(".xrow").show();
                        $("#graphWeaveRepeatYRepeats").closest(".xrow").hide();
                        $("#graphWeaveRepeatShift").closest(".xrow").show();
                        this.setItem("weaveRepeatShift", Math.round(this.weaveCopyForRepeating[0].length / 2), false, true);
                    } else if (value == "brick") {
                        $("#graphWeaveRepeatXRepeats").closest(".xrow").hide();
                        $("#graphWeaveRepeatYRepeats").closest(".xrow").show();
                        $("#graphWeaveRepeatShift").closest(".xrow").show();
                        this.setItem("weaveRepeatShift", Math.round(this.weaveCopyForRepeating.length / 2), false, true);
                    }

                } else if (gp.weaveRepeatType == "drop" && dom == "graphWeaveRepeatXRepeats") {
                    this.setItem("weaveRepeatShift", Math.round(this.weaveCopyForRepeating[0].length / gp.weaveRepeatXRepeats), false, true);

                } else if (gp.weaveRepeatType == "brick" && dom == "graphWeaveRepeatYRepeats") {
                    this.setItem("weaveRepeatShift", Math.round(this.weaveCopyForRepeating.length / gp.weaveRepeatYRepeats), false, true);

                }

                if (gp.weaveRepeatType == "block") {
                    modifiedWeave = this.weaveCopyForRepeating.transform2D8("graphWeaveRepeat.onChange", "tilexy", gp.weaveRepeatXRepeats, gp.weaveRepeatYRepeats);
                } else if (gp.weaveRepeatType == "drop") {
                    this.setMinMax("weaveRepeatShiftY", -q.graph.picks, q.graph.picks);
                    modifiedWeave = this.weaveCopyForRepeating.transform2D8("graphWeaveRepeat.onChange", "drop", gp.weaveRepeatXRepeats, gp.weaveRepeatShift);
                } else if (gp.weaveRepeatType == "brick") {
                    this.setMinMax("weaveRepeatShift", -q.graph.ends, q.graph.ends);
                    modifiedWeave = this.weaveCopyForRepeating.transform2D8("graphWeaveRepeat.onChange", "brick", gp.weaveRepeatYRepeats, gp.weaveRepeatShift);
                }
                q.graph.set(0, "weave", modifiedWeave);
                app.history.on();
            },
            onApply: function() {
                q.graph.set(0, "weave");
                this.weaveCopyForRepeating = q.graph.weave2D8.clone2D8();
                this.setItem("weaveRepeatXRepeats", 1, false, true);
                this.setItem("weaveRepeatYRepeats", 1, false, true);
                this.setItem("weaveRepeatShift", 0, false, true);
            },
            onHide: function() {
                app.history.off();
                q.graph.set(0, "weave", this.weaveCopyForRepeating);
                this.weaveCopyForRepeating = undefined;
                app.history.on();
            }
        });

        new XForm({
            id: "scaleWeave",
            parent: "graph",
            array: gp.scaleWeave,
            switchable: false,
            width: 160,
            height: 100,
            top: 100,
            right: 100,
            type: "window",
            title: "Scale Weave",
            onShow: function() {
                var form = this;
                form.setDefault("scaleWeaveEnds", q.graph.ends);
                form.setDefault("scaleWeavePicks", q.graph.picks);
                $("#graphScaleWeaveEnds").num(q.graph.ends);
                $("#graphScaleWeavePicks").num(q.graph.picks);
            },
            onApply: function() {
                var ends = $("#graphScaleWeaveEnds").num();
                var picks = $("#graphScaleWeavePicks").num();
                var resizedWeave = q.graph.weave2D8.transform2D8(10, "resize", ends, picks);
                q.graph.set(0, "weave", resizedWeave);
            }
        });

        new XForm({
            id: "generateTwill",
            parent: "graph",
            array: gp.generateTwill,
            switchable: false,
            width: 180,
            height: 240,
            top: 160,
            right: 500,
            type: "window",
            title: "Generate Twill",
            onReady: function() {
                $("#graphGenerateTwillEndPattern").keyup(function(e) {
                    var endArray = patternTextTo1D8($(this).val());
                    var twillH = endArray.length;
                    if (twillH > q.limits.maxWeaveSize) {
                        console.log("twillH Error!:" + twillH);
                        return;
                    }
                    var warpProjection = Math.round(arraySum(endArray) / twillH * 100);
                    $("#graphGenerateTwillWarpProjection").num(warpProjection);
                    $("#graphGenerateTwillEndRisers").num(arraySum(endArray));
                    $("#graphGenerateTwillHeight").num(twillH);

                    var warpProjectionInput = $("#graphGenerateTwillWarpProjection input");
                    warpProjectionInput.attr("data-min", Math.round(100 / twillH));

                    var endRisersInput = $("#graphGenerateTwillEndRisers input");
                    endRisersInput.attr("data-max", twillH);

                    updateSatinMoveNumberSelect(twillH);
                });
            },
            onShow: function() {
                let endArray = q.graph.weave2D8[0].slice();
                var currentEndPattern = Array1D8ToPatternText(endArray);
                $("#graphGenerateTwillEndPattern").val(currentEndPattern);
                $("#graphGenerateTwillEndPattern").keyup();
            },
            onApply: function() {
                var createdRandom = gp.generateTwillGenerateRandom;
                if (createdRandom) {
                    var randomEnd = makeRandomEnd(gp.generateTwillHeight, "text", gp.generateTwillWarpProjection);
                    $("#graphGenerateTwillEndPattern").val(randomEnd);
                    gp.generateTwillEndPattern = randomEnd;
                    // updateSatinMoveNumberSelect(endSize);
                }
                var end8 = patternTextTo1D8(gp.generateTwillEndPattern);
                var twillDirection = gp.generateTwillDirection;
                var moveNum = gp.generateTwillMoveNumber;
                var twillWeave = generateTwill(end8, twillDirection, moveNum);
                q.graph.set(0, "weave", twillWeave);
            },
            onChange: function(dom, value) {

                if (dom == "graphGenerateTwillHeight") {

                    let twillH = $("#graphGenerateTwillHeight").num();

                    let warpProjectionInput = $("#graphGenerateTwillWarpProjection input");
                    warpProjectionInput.attr("data-min", Math.round(100 / twillH));

                    let endRisersInput = $("#graphGenerateTwillEndRisers input");
                    endRisersInput.attr("data-max", twillH);

                    let endRisers = $("#graphGenerateTwillEndRisers").num();
                    endRisers = limitNumber(endRisers, 1, twillH);

                    let warpProjection = Math.round(endRisers / twillH * 100);

                    $("#graphGenerateTwillEndRisers").num(endRisers);
                    $("#graphGenerateTwillWarpProjection").num(warpProjection);

                    updateSatinMoveNumberSelect(twillH);

                } else if (dom == "graphGenerateTwillEndRisers") {
                    let twillH = $("#graphGenerateTwillHeight").num();
                    let endRisers = $("#graphGenerateTwillEndRisers").num();
                    let warpProjection = Math.round(endRisers / twillH * 100);
                    $("#graphGenerateTwillWarpProjection").num(warpProjection);

                } else if (dom == "graphGenerateTwillWarpProjection") {
                    let twillH = $("#graphGenerateTwillHeight").num();
                    let warpProjection = $("#graphGenerateTwillWarpProjection").num();
                    let endRisers = Math.round(twillH / 100 * warpProjection);
                    $("#graphGenerateTwillEndRisers").num(endRisers);

                } else if (dom == "graphGenerateTwillGenerateRandom") {
                    $("#graphGenerateTwillEndPattern").prop('readonly', value);
                    $("#graphGenerateTwillEndPattern").prop('disabled', value);

                }

            }
        });

        new XForm({
            toolbar: app.views.graph.toolbar,
            button: "toolbar-graph-auto-colorway",
            id: "graphAutoColorway",
            parent: "graph",
            array: gp.autoColorway,
            type: "popup",
            title: "Auto Colorway",
            onShow: function() {
                this.showRow("autoColorwayLockedColors", gp.autoColorwayLockColors);
            },
            onApply: function() {
                var lockedColors = $("#graphAutoColorwayLockedColors").val().replace(/[^A-Za-z]/g, "").split("").unique().join("");
                gp.autoColorwayLockedColors = lockedColors;
                $("#graphAutoColorwayLockedColors").val(lockedColors);
                autoColorway();
                q.graph.needsUpdate(1, "weave");
            },
            onChange: function(dom, value) {
                var el;
                if (dom == "graphAutoColorwayLockColors") {
                    this.showRow("autoColorwayLockedColors", value, q.pattern.colors("fabric").join(""));
                } else if (dom == "graphAutoColorwayShareColors") {
                    gp.autoColorwayLinkColors = value;
                    el = $("#graphAutoColorwayLinkColors");
                    el.prop("checked", value);
                }
            }
        });

        new XForm({
            toolbar: app.views.graph.toolbar,
            button: "toolbar-graph-view-settings",
            id: "graphViewSettings",
            parent: "graph",
            array: gp.viewSettings,
            type: "popup",
            title: "View Settings",
            active: true,
            onChange: function(dom, value) {
                q.pattern.needsUpdate();
                q.graph.needsUpdate();
            }
        });

        new XForm({
            toolbar: app.views.graph.toolbar,
            button: "toolbar-graph-locks",
            id: "graphLocks",
            parent: "graph",
            array: gp.locks,
            type: "popup",
            title: "Auto Locks",
            active: true,
            onChange: function(dom, value) {
                var el;
                if (dom == "graphAutoTrim") {
                    if (value) {
                        if (q.graph.liftingMode == "weave") {
                            q.graph.set(0, "weave");
                        } else {
                            app.history.off();
                            q.graph.set(0, "threading", false, {
                                propagate: false
                            });
                            q.graph.set(0, "lifting", false, {
                                propagate: false
                            });
                            q.graph.set(0, "tieup", false, {
                                propagate: false
                            });
                            q.graph.setWeaveFromParts();
                            app.history.on();
                            app.history.record("onAutoTrim", ...app.state.graphItems);
                        }
                    }
                }
            }
        });

        new XForm({
            toolbar: app.views.graph.toolbar,
            button: "toolbar-graph-auto-palette",
            id: "graphAutoPalette",
            parent: "graph",
            array: gp.autoPalette,
            type: "popup",
            title: "Auto Palette",
            reset: false,
            onApply: function() {
                let params = {
                    coverSpectrum: gp.autoPaletteCoverSpectrum,
                    minHue: gp.autoPaletteMinHue,
                    maxHue: gp.autoPaletteMaxHue,
                    minSaturation: gp.autoPaletteMinSaturation,
                    maxSaturation: gp.autoPaletteMaxSaturation,
                    minLuminosity: gp.autoPaletteMinLuminosity,
                    maxLuminosity: gp.autoPaletteMaxLuminosity,
                };
                q.palette.set("random", params);
            }
        });
    }

    function setCursor(value = "default") {

        $(".graph-canvas").removeClass('cur-hand cur-grab cur-cross cur-zoom');
        $("body").removeClass("cursor-nesw-resize");
        $("html").removeClass("cursor-nesw-resize");

        if (value == "cross") {
            $(".graph-canvas").addClass("cur-cross");
        } else if (value == "hand") {
            $(".graph-canvas").addClass("cur-hand");
        } else if (value == "zoom") {
            $(".graph-canvas").addClass("cur-zoom");
        } else if (value == "grab") {
            $(".graph-canvas").addClass("cur-grab");
        } else if (value == "nesw-resize") {
            $("body").addClass("cursor-nesw-resize");
            $("html").addClass("cursor-nesw-resize");
        } else if (value == "default") {
            if (q.graph.tool == "selection" && Selection.grabbed) {
                setCursor("grab");
            } else if (q.graph.tool == "selection" && Selection.isMouseOver && !Selection.grabbed) {
                setCursor("hand");
            } else if (q.graph.tool == "selection" && !Selection.isMouseOver) {
                setCursor("cross");
            } else if (q.graph.tool == "hand") {
                setCursor("hand");
            } else if (q.graph.tool == "zoom") {
                setCursor("zoom");
            }
        }

    }

    // ----------------------------------------------------------------------------------
    // Right Click Context Menu Event Functions
    // ----------------------------------------------------------------------------------
    function paletteContextMenuClick(id) {
        var code = q.palette.rightClicked;

        if (id == "swap-with") {
            q.palette.markChip(code, "swap");

        } else if (id == "change-to") {
            q.palette.markChip(code, "change");

        } else if (id == "edit-yarn") {
            q.palette.clearSelection();
            q.palette.showYarnPopup(code);

        } else if (id == "cancel-menu") {
            q.palette.clearMarker();
            app.contextMenu.palette.obj.hideContextMenu();

        }
    }

    function patternContextMenuClick(id) {

        // console.log(id);

        var element, parent, parentId, elementIndex, lastElement, colorCode, stripeFirstIndex, stripeLastIndex, yarnSet;

        if (id == "delete_single") {
            q.pattern.delete(yarnSet, elementIndex, elementIndex);

        } else if (id == "copy") {
            patternSelection.startfor("copy");

        } else if (id == "mirror") {
            patternSelection.startfor("mirror");

        } else if (id == "delete_multiple") {
            patternSelection.startfor("delete");

        } else if (id == "flip") {
            patternSelection.startfor("flip");

        } else if (id == "insert_left") {
            q.pattern.insert("warp", q.palette.selected, threadi - 1);

        } else if (id == "insert_right") {
            q.pattern.insert("warp", q.palette.selected, threadi);

        } else if (id == "insert_above") {
            q.pattern.insert("weft", q.palette.selected, threadi);

        } else if (id == "insert_below") {
            q.pattern.insert("weft", q.palette.selected, threadi - 1);

        } else if (id == "fill") {
            patternSelection.startfor("fill");

        } else if (id == "repeat") {
            patternSelection.startfor("repeat");

        } else if (id == "pattern-code") {
            XWin.show("patternCode");

        } else if (id == "pattern-tile") {
            XWin.show("patternTile");

        } else if (id == "pattern-scale") {
            XWin.show("patternScale");

        } else if (id == "stripe-resize") {
            XWin.show("graphStripeResize");

        } else if (id == "clear-warp") {
            q.pattern.clear("warp");

        } else if (id == "clear-weft") {
            q.pattern.clear("weft");

        } else if (id == "clear-warp-weft") {
            q.pattern.clear();

        } else if (id == "copy-warp-to-weft") {
            q.pattern.set(29, "weft", q.pattern.warp);

        } else if (id == "copy-weft-to-warp") {
            q.pattern.set(29, "warp", q.pattern.weft);

        } else if (id == "copy-swap") {
            var temp = q.pattern.warp;
            q.pattern.set(31, "warp", q.pattern.weft);
            q.pattern.set(32, "weft", temp);

        }
    }

    function weaveContextMenuClick(id) {
        var endNum = app.mouse.end;
        var pickNum = app.mouse.pick;
        var endIndex = endNum - 1;
        var pickIndex = pickNum - 1;

        if (id == "delete_ends") {

        } else if (id == "delete_picks") {

        } else if (id == "insert_ends") {

        } else if (id == "insert_picks") {

        } else if (id == "insert_end_right") {
            q.graph.insertEndAt(endNum + 1);

        } else if (id == "insert_end_left") {
            q.graph.insertEndAt(endNum);

        } else if (id == "insert_pick_below") {
            q.graph.insertPickAt(pickNum);

        } else if (id == "insert_pick_above") {
            q.graph.insertPickAt(pickNum + 1);

        } else if (id == "clear") {

        } else if (id == "copy") {

        } else if (id == "cancel") {

        } else if (id == "crop") {

        } else if (id == "fill") {

        } else if (id == "stamp") {

        } else if (id == "inverse") {

        } else if (id == "flip_horizontal") {

        } else if (id == "flip_vertical") {

        } else if (id == "reposition") {

        } else if (id == "build3d") {
            tp.startEnd = 1;
            tp.startPick = 1;
            tp.warpThreads = q.graph.ends;
            tp.weftThreads = q.graph.picks;
            app.views.show("three");
            q.three.buildFabric();

        }
    }

    function selectionContextMenuClick(id) {

        if (id == "copy") {
            app.selection.copy();

        } else if (id == "paste") {
            app.selection.startPaste(app.mouse.rightClick.graph);

        } else if (id == "stamp") {
            app.selection.startStamp(app.mouse.rightClick.graph);

        } else if (id == "fill") {
            app.selection.startFill();

        } else if (id == "crop") {
            app.selection.crop();

        } else if (id == "erase") {
            app.selection.erase();

        } else if (id == "inverse") {
            app.selection.inverse();

        } else if (id == "delete_ends") {
            app.selection.deleteGraphColumns();

        } else if (id == "delete_picks") {
            app.selection.deleteGraphRows();

        } else if (id == "flipx") {
            app.selection.flipX();

        } else if (id == "flipy") {
            app.selection.flipY();

        } else if (id == "add_to_library") {
            app.selection.addToLibrary();

        } else if (id == "build3d") {
            app.selection.build3D();

        } else if (id == "deselect") {
            app.selection.deselect();

        } else if (id == "cancel") {
            Selection.postAction = false;

        }
    }

    // Firebase
    let fb = {
        get auth() {
            if (typeof firebase == 'undefined') return false;
            return firebase.auth();
        },
        get fs() {
            if (typeof firebase == 'undefined') return false;
            return firebase.firestore();
        },
        get db() {
            if (typeof firebase == 'undefined') return false;
            return firebase.database();
        },
        registerEvents: function() {
            if (typeof firebase == undefined) return false;
            fb.fs.collection("global").doc("site_data").onSnapshot(app.checkForUpdate);
        }
    };

    var app = {

        DEV_MODE: false,
        version: 1,
        origin: "bl",
        allowKeyboardShortcuts: true,

        checkFirestoreAppStatus() {
            return new Promise((resolve, reject) => {
                if (typeof firebase == 'undefined') resolve(false);
                let siteDataRef = fb.fs.collection("global").doc("site_data");
                siteDataRef.get().then((doc) => {
                    if (doc.exists) {
                        let data = doc.data();
                        let appStatus = data.app_status;
                        console.log(appStatus);
                        if (appStatus) {
                            console.log("app.status.true");
                            resolve(true);
                        } else {
                            console.log("app.status.false");
                            resolve(false);
                        }
                    } else {
                        console.log("app.status.notset");
                        resolve(false);
                    }
                }).catch((error) => {
                    console.log("Error getting document:", error);
                    console.log("app.status.error");
                    resolve(false);
                });
            });
        },

        checkForUpdate: function() {
            let siteDataRef = fb.fs.collection("global").doc("site_data");
            siteDataRef.get().then((doc) => {
                if (doc.exists) {
                    let data = doc.data();
                    let latest_version = toNum(data.app_version);
                    if (latest_version > app.version) {
                        console.log("app.version.updated = " + latest_version);
                    } else {
                        console.log("app.version = " + latest_version);
                    }
                } else {
                    console.log("No such document!");
                }
            }).catch((error) => {
                console.log("Error getting document:", error);
            });
        },

        alertDialog: false,
        alert: function(type, title, msg) {
            let icon = 'fa fa-warning';
            this.alertDialog = $.alert({
                type: type,
                title: title,
                content: msg,
                boxWidth: '25%',
                useBootstrap: false,
                icon: icon,
                animateFromElement: false,
                theme: 'modern'
            });
        },

        confirmDialog: false,
        confirm: function(type, title, msg) {
            let btnClass;
            let icon = 'fa fa-warning';
            if (type == "red") {
                btnClass = 'btn-red';
            } else if (type == "blue") {
                btnClass = 'btn-blue';
            }
            let _this = this;
            return new Promise((resolve, reject) => {
                _this.confirmDialog = $.confirm({
                    title: title,
                    boxWidth: '25%',
                    useBootstrap: false,
                    icon: icon,
                    animateFromElement: false,
                    content: msg,
                    type: type,
                    theme: 'modern',
                    buttons: {
                        ok: {
                            text: "Ok",
                            btnClass: btnClass,
                            keys: ['enter'],
                            action: function() { resolve(true); }
                        },
                        cancel: function() { resolve(false); }
                    }
                });
            });
        },

        selection: {

            get selected() {
                return q.graph.get(Selection.graph, Selection.sx + 1, Selection.sy + 1, Selection.lx + 1, Selection.ly + 1);
            },

            postAction: function(graph, col, row) {

                if (graph && Selection.postAction) {

                    var res;

                    var canvas2D8 = q.graph.get(graph);
                    var seamlessX = lookup(graph, ["weave", "threading"], [gp.seamlessWeave, gp.seamlessThreading]);
                    var seamlessY = lookup(graph, ["weave", "lifting"], [gp.seamlessWeave, gp.seamlessLifting]);
                    var xOverflow = seamlessX ? "loop" : "extend";
                    var yOverflow = seamlessY ? "loop" : "extend";

                    if (Selection.pasting && app.mouse.isUp) {
                        res = paste2D8(Selection.content, canvas2D8, col - 1, row - 1, xOverflow, yOverflow, 0);
                        q.graph.set(0, graph, res);
                        Selection.cancel();

                    } else if (Selection.stamping && app.mouse.isUp) {
                        res = paste2D8(Selection.content, canvas2D8, col - 1, row - 1, xOverflow, yOverflow, 0);
                        q.graph.set(0, graph, res);

                    } else if (Selection.filling) {
                        var filled = arrayTileFill(Selection.content, Selection.width, Selection.height);
                        res = paste2D8(filled, canvas2D8, Selection.minX, Selection.minY, xOverflow, yOverflow, 0);
                        Selection.postAction = false;
                        q.graph.set(0, graph, res);

                    }

                }

            },
            selectAll: function() {
                let graph = app.mouse.graph;
                let arrW = 1;
                let arrH = 1;
                if (!graph.in("warp", "weft", "weave", "threading", "lifting", "tieup")) {
                    return false;
                } else if (graph.in("weave", "threading", "lifting", "tieup")) {
                    let arr = q.graph[graph + "2D8"];
                    arrW = arr.length;
                    arrH = arr[0].length;
                } else if (graph == "warp") {
                    arrW = q.pattern[graph].length;
                } else if (graph == "weft") {
                    arrH = q.pattern[graph].length;
                }
                Selection.setActive(graph);
                Selection.select(graph, 0, 0, arrW - 1, arrH - 1);
            },
            copy: function() {
                if (!Selection.isCompleted) return;
                Selection.content = app.selection.selected;
                Selection.contentType = Selection.graph;
            },
            cut: function() {
                if (!Selection.isCompleted) return;
                this.copy();
                this.erase();
            },
            startPaste: function(targetGraph) {
                if (!Selection.content.length) return;
                Selection.setActive(targetGraph);
                Selection.clear();
                Selection.postAction = "paste";
                var selectionMouse = getGraphMouse(Selection.graph, app.mouse.x, app.mouse.y);
                Selection.onMouseMove(Selection.graph, selectionMouse.col - 1, selectionMouse.row - 1);
            },
            crop: function() {
                app.history.off();
                Selection.clear();
                if (Selection.graph == "weave" && gp.drawStyle.in("color", "yarn")) {
                    var selectionWeave = q.graph.weave2D8.copy2D8(Selection.minX, Selection.minY, Selection.maxX, Selection.maxY, "loop", "loop");
                    var selectionWarp = copy1D(q.pattern.warp, Selection.minX, Selection.maxX, "loop");
                    var selectionWeft = copy1D(q.pattern.weft, Selection.minY, Selection.maxY, "loop");
                    q.graph.set(0, "weave", selectionWeave);
                    q.pattern.set(29, "warp", selectionWarp);
                    q.pattern.set(29, "weft", selectionWeft);
                } else {
                    q.graph.set(0, Selection.graph, app.selection.selected);
                }
                app.history.on();
                app.history.record("crop", "weave", "ends", "picks", "warp", "weft");
            },
            erase: function() {
                if (!Selection.isCompleted) return;
                var blank = newArray2D8(100, Selection.width, Selection.height);
                q.graph.set(0, Selection.graph, blank, {
                    col: Selection.minX + 1,
                    row: Selection.minY + 1
                });
            },
            inverse: function() {
                let inverse = app.selection.selected.transform2D8(22, "inverse");
                q.graph.set(0, Selection.graph, inverse, {
                    col: Selection.minX + 1,
                    row: Selection.minY + 1
                });
            },

            startStamp: function(targetGraph) {
                if (!Selection.content.length) return;
                Selection.setActive(targetGraph);
                Selection.clear();
                Selection.postAction = "stamp";
                var selectionMouse = getGraphMouse(Selection.graph, app.mouse.x, app.mouse.y);
                Selection.onMouseMove(Selection.graph, selectionMouse.col - 1, selectionMouse.row - 1);
            },
            startFill: function() {
                if (!Selection.content.length) return;
                Selection.clear();
                Selection.postAction = "fill";
            },
            deleteGraphColumns: async function() {
                let doDelete = true;
                let startX = Selection.minX;
                let lastX = Selection.maxX;
                let graph = Selection.graph;
                let graphWidth = q.graph[graph + "2D8"].length;
                var seamlessX = lookup(graph, ["weave", "threading"], [gp.seamlessWeave, gp.seamlessThreading]);
                if (seamlessX) {
                    startX = loopNumber(startX, graphWidth);
                    lastX = loopNumber(lastX, graphWidth);
                }
                if (Selection.width >= (graphWidth - 2)) {
                    doDelete = false;
                    let items = lookup(graph, ["weave", "threading", "tieup"], ['ends', 'ends', "shafts"], false);
                    app.alert('orange', 'Error!', `Maximum ${graphWidth-2} ${items} of this ${graph} can be deleted in seamless mode. Make a smaller selection. Can't proceed!`);
                }
                if (doDelete) {
                    if (graph == "weave" && q.graph.liftingMode.in("treadling", "liftplan")) graph = "threading";
                    q.graph.delete.columns(graph, startX, lastX);
                    if (q.graph.liftingMode == "treadling" && graph.in("tieup", "lifting")) {
                        await delay(500);
                        let correspondingGraph = graph == "tieup" ? "lifting" : "tieup";
                        let deleteCorresponding = await app.confirm('blue', 'Delete', `Delete corresponding columns in ${correspondingGraph}?`);
                        if (deleteCorresponding) {
                            q.graph.delete.columns(correspondingGraph, startX, lastX);
                        }
                    }
                }
            },
            deleteGraphRows: async function() {
                let doDelete = true;
                let startY = Selection.minY;
                let lastY = Selection.maxY;
                let graph = Selection.graph;
                let graphHeight = q.graph[graph + "2D8"][0].length;
                var seamlessY = lookup(graph, ["weave", "lifting"], [gp.seamlessWeave, gp.seamlessLifting], false);
                if (seamlessY) {
                    startY = loopNumber(startY, graphHeight);
                    lastY = loopNumber(lastY, graphHeight);
                }
                if (Selection.height >= (graphHeight - 2)) {
                    doDelete = false;
                    let items = lookup(graph, ["weave", "lifting", "tieup"], ['picks', 'picks', "treadles"]);
                    app.alert('orange', 'Error!', `Maximum ${graphHeight-2} ${items} of this ${graph} can be deleted in seamless mode. Make a smaller selection. Can't proceed!`);
                }
                if (doDelete) {
                    if (graph == "weave" && q.graph.liftingMode.in("treadling", "liftplan")) graph = "lifting";
                    q.graph.delete.rows(graph, startY, lastY);
                    if (graph.in("tieup", "threading")) {
                        await delay(500);
                        let correspondingGraph = graph == "tieup" ? "threading" : "tieup";
                        let deleteCorresponding = await app.confirm('blue', 'Delete', `Delete corresponding rows in ${correspondingGraph}?`);
                        if (deleteCorresponding) {
                            q.graph.delete.rows(correspondingGraph, startY, lastY);
                        }
                    }
                }
            },
            flipX: function() {
                var xFlipped = app.selection.selected.transform2D8(22, "flipx");
                q.graph.set(0, Selection.graph, xFlipped, {
                    col: Selection.minX + 1,
                    row: Selection.minY + 1
                });
            },
            flipY: function() {
                var yFlipped = app.selection.selected.transform2D8(22, "flipy");
                q.graph.set(0, Selection.graph, yFlipped, {
                    col: Selection.minX + 1,
                    row: Selection.minY + 1
                });
            },
            addToLibrary: function() {
                let selected = app.selection.selected;
                XWin.show("weaveLibraryAdd", selected);
            },
            build3D: function() {
                tp.warpThreads = Selection.width;
                tp.weftThreads = Selection.height;
                tp.warpStart = Selection.minX + 1;
                tp.weftStart = Selection.minY + 1;
                app.views.show("three");
                q.three.buildFabric();
            },
            deselect: function() {
                Selection.cancel();
                setCursor();
            }

        },

        requestAnimationFrame: function() {

            window.requestAnimationFrame(() => {

                if (app.views.active == "graph") {
                    q.graph.update();
                    q.pattern.update();
                    autoEdgeScroll();
                    Selection.update();

                } else if (app.views.active == "model" && q.model.needsUpdate) {
                    const now = performance.now();
                    while (q.model.fps.length > 0 && q.model.fps[0] <= now - 1000) q.model.fps.shift();
                    q.model.fps.push(now);
                    Debug.item("FPS", q.model.fps.length, "model");

                    if (q.model.model && mp.autoRotate && mp.allowAutoRotate) {
                        q.model.model.rotation.y += mp.rotationSpeed * mp.rotationDirection;
                        mp.viewPresets.update("user");
                    }
                    //q.model.controls.update();
                    q.model.render();
                    q.model.needsUpdate = false;

                }

                requestAnimationFrame(app.requestAnimationFrame);

            });

        },

        anglePicker: {
            id: "appAnglePicker",
            element: undefined,
            popup: undefined,
            object: undefined,
            create: function() {
                let _this = this;
                this.popup = new dhtmlXPopup({
                    mode: "right"
                });
                app.popups.list[this.id] = this.popup;

                var anglePickerHTML = '';
                anglePickerHTML += '<div id="anglePickerContainer">';
                anglePickerHTML += '<div id="anglePickerDom"></div>';
                anglePickerHTML += '<div class="a9-btn a9-tl" data-btn="tl"></div>';
                anglePickerHTML += '<div class="a9-btn a9-tc" data-btn="tc"></div>';
                anglePickerHTML += '<div class="a9-btn a9-tr" data-btn="tr"></div>';
                anglePickerHTML += '<div class="a9-btn a9-ml" data-btn="ml"></div>';
                anglePickerHTML += '<div class="a9-btn a9-mr" data-btn="mr"></div>';
                anglePickerHTML += '<div class="a9-btn a9-bl" data-btn="bl"></div>';
                anglePickerHTML += '<div class="a9-btn a9-bc" data-btn="bc"></div>';
                anglePickerHTML += '<div class="a9-btn a9-br" data-btn="br"></div>';
                anglePickerHTML += '</div>';

                $("#noshow").append(anglePickerHTML);
                $("#anglePickerDom").roundSlider({
                    width: 3,
                    radius: 20,
                    value: 0,
                    mouseScrollAction: true,
                    max: "359",
                    handleSize: 12,
                    animation: false,
                    showTooltip: false,
                    handleShape: "square",
                });
                this.object = $("#anglePickerDom").data("roundSlider");

                this.popup.attachObject("anglePickerContainer");

                $("#anglePickerDom").on("valueChange", function(e) {
                    _this.element.num(e.value);
                    _this.element.trigger("onChange", e.value);
                });

                this.popup.attachEvent("onBeforeHide", function(type, ev, id) {
                    console.log("onBeforeHide");
                    _this.element.trigger("anglePickerBeforeHide");
                    return true; // return false;
                });
                this.popup.attachEvent("onHide", function() {
                    console.log("onAnglePickerHide");
                    _this.element.trigger("pickerHide");
                });
                this.popup.attachEvent("onShow", function(id) {
                    console.log("onAnglePickerShow");
                    _this.element.trigger("anglePicker");
                });
                this.popup.attachEvent("onContentClick", function(evt) {
                    // console.log([form.id, "onContentClick"]);
                });
                this.popup.attachEvent("onClick", function(id) {
                    // console.log([form.id, "onClick"]);
                });

                $('#anglePickerContainer').find('.a9-btn').click(function(e) {
                    if (e.which === 1) {
                        var btn = $(this).attr("data-btn");
                        if (btn == "ml") _this.object.setValue(0);
                        else if (btn == "tl") _this.object.setValue(45);
                        else if (btn == "tc") _this.object.setValue(90);
                        else if (btn == "tr") _this.object.setValue(135);
                        else if (btn == "mr") _this.object.setValue(180);
                        else if (btn == "br") _this.object.setValue(225);
                        else if (btn == "bc") _this.object.setValue(270);
                        else if (btn == "bl") _this.object.setValue(315);
                    }
                    return false;
                });

            },
            show: function(element) {
                this.element = element;
                var hex = element.bgcolor();
                var x = element.offset().left;
                var y = element.offset().top;
                var w = element.width();
                var h = element.height();
                //this.object.setColor(hex);
                this.popup.show(x, y, w, h);
            }
        },

        colorPicker: {
            id: "appColorPicker",
            element: undefined,
            popup: undefined,
            object: undefined,
            create: function() {
                let _this = this;
                this.popup = new dhtmlXPopup({
                    mode: "right"
                });
                app.popups.list[this.id] = this.popup;
                this.object = this.popup.attachColorPicker();
                this.object.showMemory();
                this.object.setCustomColors("#000000", "#FFFFFF", "#7F7F7F");
                // Tab Index for paletteColorPopup color inputs
                var hsl_inputs = $(".dhxcp_inputs_cont input.dhxcp_input_hsl");
                var rgb_inputs = $(".dhxcp_inputs_cont input.dhxcp_input_rgb");
                hsl_inputs.eq(0).attr("tabIndex", 1);
                hsl_inputs.eq(1).attr("tabIndex", 2);
                hsl_inputs.eq(2).attr("tabIndex", 3);
                rgb_inputs.eq(0).attr("tabIndex", 4);
                rgb_inputs.eq(1).attr("tabIndex", 5);
                rgb_inputs.eq(2).attr("tabIndex", 6);
                this.object.attachEvent("onCancel", function(color) {
                    _this.popup.hide();
                    return false;
                });
                this.object.attachEvent("onChange", function(color) {
                    _this.element.trigger("change", color);
                });
                this.object.attachEvent("onSelect", function(color) {
                    _this.element.trigger("change", color);
                    _this.popup.hide();
                });
                this.popup.attachEvent("onShow", function(id) {
                    _this.element.trigger("colorPicker");
                });
                this.popup.attachEvent("onBeforeHide", function(type, ev, id) {
                    _this.element.trigger("colorPickerBeforeHide");
                    return true; // return false;
                });
                this.popup.attachEvent("onHide", function() {
                    _this.element.trigger("pickerHide");
                });
                this.popup.attachEvent("onContentClick", function(evt) {
                    // console.log([form.id, "onContentClick"]);
                });
                this.popup.attachEvent("onClick", function(id) {
                    // console.log([form.id, "onClick"]);
                });

            },
            show: function(element) {
                this.element = element;
                var hex = element.bgcolor();
                var x = element.offset().left;
                var y = element.offset().top;
                var w = element.width();
                var h = element.height();
                this.object.setColor(hex);
                this.popup.show(x, y, w, h);
            }
        },

        popups: {
            list: {},
            array: [],
            hide: function() {
                for (let popupId in this.list) {
                    this.list[popupId].hide();
                }
            }
        },

        frame: {
            width: 0,
            height: 0
        },

        contextMenu: {

            palette: {
                xml: "xml/context_palette.xml",
                zone: "palette-container",
                onLoad: function() {},
                onBeforeContextMenu: function(zoneId, e) {
                    var code = q.palette.rightClicked;
                    var inPattern = q.pattern.warp.includes(code) || q.pattern.weft.includes(code);
                    let menu = app.contextMenu.palette;
                    if (inPattern) {
                        menu.enable("swap-with", "change-to");
                    } else {
                        menu.disable("swap-with", "change-to");
                    }
                    return true;
                },
                onContextMenu: function(zoneId, e) {
                    app.allowKeyboardShortcuts = false;
                },
                onClick: function(id) {
                    paletteContextMenuClick(id);
                },
                onHide: function(id) {
                    app.allowKeyboardShortcuts = true;
                }
            },

            pattern: {
                xml: "xml/context_pattern.xml",
                onLoad: function() {

                },
                onBeforeContextMenu: function(zoneId, e) {},
                onContextMenu: function(zoneId, e) {
                    app.allowKeyboardShortcuts = false;
                },
                onClick: function(id) {
                    patternContextMenuClick(id);
                },
                onHide: function(id) {
                    app.allowKeyboardShortcuts = true;
                }
            },

            tools: {
                xml: "xml/context_tools.xml",
                onLoad: function() {

                },
                onBeforeContextMenu: function(zoneId, e) {},
                onContextMenu: function(zoneId, e) {
                    app.allowKeyboardShortcuts = false;
                },
                onClick: function(id) {
                    if (id == "close") {
                        app.contextMenu.tools.obj.hideContextMenu();
                    } else {
                        q.graph.tool = id;
                    }
                },
                onHide: function(id) {
                    app.allowKeyboardShortcuts = true;
                }
            },

            selection: {
                xml: "xml/context_selection.xml",
                onLoad: function() {},
                onBeforeContextMenu: function(zoneId, e) {},
                onContextMenu: function(zoneId, e) {
                    app.allowKeyboardShortcuts = false;
                    let menu = app.contextMenu.selection;
                    if (Selection.graph == "weave" && Selection.isCompleted) {
                        menu.obj.showItem("build3d");
                    } else {
                        menu.obj.hideItem("build3d");
                    }
                    let completeItems = ["copy", "crop", "erase", "flip", "flipx", "flipy", "inverse", "delete", "deselect", "add_to_library"];
                    if (Selection.isCompleted) {
                        menu.enable(...completeItems);
                    } else {
                        menu.disable(...completeItems);
                    }
                    if (Selection.content.length) {
                        menu.enable("paste", "fill", "stamp");
                    } else {
                        menu.disable("paste", "fill", "stamp");
                    }
                },
                onClick: function(id) {
                    console.log("onclick");
                    selectionContextMenuClick(id);
                },
                onHide: function(id) {
                    app.allowKeyboardShortcuts = true;
                }
            },

            weave: {
                xml: "xml/context_weave.xml",
                onLoad: function() {

                },
                onBeforeContextMenu: function(zoneId, e) {},
                onContextMenu: function(zoneId, e) {

                    let menu = app.contextMenu.weave;

                    if (q.graph.tool == "zoom" || q.graph.tool == "brush") {
                        //menu.hideContextMenu();

                    } else {

                        app.allowKeyboardShortcuts = false;

                        var weaveArray = q.graph.weave2D8;

                        if (weaveArray.length == q.limits.maxWeaveSize) {
                            menu.disable("insert_end");
                        } else {
                            menu.enable("insert_end");
                        }

                        if (weaveArray[0].length == q.limits.maxWeaveSize) {
                            menu.disable("insert_pick");
                        } else {
                            menu.enable("insert_pick");
                        }

                        if (weaveArray.length == q.limits.maxWeaveSize && weaveArray[0].length == q.limits.maxWeaveSize) {
                            menu.disable("insert");
                        } else {
                            menu.enable("insert");
                        }

                        if (weaveArray.length == q.limits.minWeaveSize) {
                            menu.disable("delete_ends", "flip_horizontal");
                        } else {
                            menu.enable("delete_ends", "flip_horizontal");
                        }

                        if (weaveArray[0].length == q.limits.minWeaveSize) {
                            menu.disable("delete_picks", "flip_vertical");
                        } else {
                            menu.enable("delete_picks", "flip_vertical");
                        }

                        if (weaveArray.length == q.limits.minWeaveSize && weaveArray[0].length == q.limits.minWeaveSize) {
                            menu.disable("delete", "crop", "fill", "copy", "flip", "shift", "clear", "inverse");
                        } else {
                            menu.enable("delete", "crop", "fill", "copy", "flip", "shift", "clear", "inverse");
                        }

                    }
                },
                onClick: function(id) {
                    weaveContextMenuClick(id);
                },
                onHide: function(id) {
                    app.allowKeyboardShortcuts = true;
                }
            },

            load: function(id) {
                let _this = app.contextMenu;
                return new Promise((resolve, reject) => {
                    _this[id].obj = new dhtmlXMenuObject({
                        icons_path: "img/icons/",
                        context: true,
                        xml: _this[id].xml,
                        onload: function() {
                            let menu = _this[id];
                            if (menu.zone !== undefined) {
                                menu.obj.addContextZone(menu.zone);
                            }
                            if (typeof menu.onClick === "function") {
                                menu.obj.attachEvent("onClick", menu.onClick);
                            }
                            if (typeof menu.onBeforeContextMenu === "function") {
                                menu.obj.attachEvent("onBeforeContextMenu", menu.onBeforeContextMenu);
                            }
                            if (typeof menu.onContextMenu === "function") {
                                menu.obj.attachEvent("onContextMenu", menu.onContextMenu);
                            }
                            if (typeof menu.onHide === "function") {
                                menu.obj.attachEvent("onHide", menu.onHide);
                            }
                            if (typeof menu.onload === "function") menu.onload();

                            menu.enable = function(...ids) {
                                ids.forEach(function(v, i) {
                                    menu.obj.setItemEnabled(v);
                                });
                            };

                            menu.disable = function(...ids) {
                                ids.forEach(function(v, i) {
                                    menu.obj.setItemDisabled(v);
                                });
                            };

                            resolve();
                        }
                    });
                });
            },

            hide: function(id) {
                if (id) {
                    app.contextMenu[id].obj.hideContextMenu();
                } else {
                    ["palette", "pattern", "tools", "weave", "selection"].forEach(v => {
                        app.contextMenu[v].obj.hideContextMenu();
                    });
                }
            }

        },

        views: {

            active: undefined,

            graph: {
                content: "graph-frame",
                menu_xml: "xml/menu_graph.xml",
                toolbar_xml: "xml/toolbar_graph.xml",
                created: false,
                needsUpdate: true,
                update: function(instanceId = 0) {
                    if (!this.created) {
                        createGraphPopups();
                        this.created = true;
                    }
                    if (this.needsUpdate) {
                        q.graph.setInterface(instanceId);
                        this.needsUpdate = false;
                    }
                    q.graph.needsUpdate(61);
                    q.pattern.needsUpdate(5);
                }
            },

            artwork: {
                content: "artwork-frame",
                menu_xml: "xml/menu_artwork.xml",
                toolbar_xml: "xml/toolbar_artwork.xml",
                created: false,
                needsUpdate: true,
                update: function(instanceId = 0, render = true) {
                    if (!this.created) {
                        createArtworkPopups();
                        q.artwork.history.record("onArtworkInterfaceCreate");
                        this.created = true;
                    }
                    if (this.needsUpdate) {
                        q.artwork.setInterface(instanceId, render);
                        this.needsUpdate = false;
                    }
                    q.artwork.render();
                }
            },

            simulation: {
                content: "simulation-frame",
                menu_xml: "xml/menu_simulation.xml",
                toolbar_xml: "xml/toolbar_simulation.xml",
                created: false,
                needsUpdate: true,
                update: function(instanceId = 0, render = true) {
                    if (!this.created) {
                        createSimulationPopups();
                        this.created = true;
                    }
                    if (this.needsUpdate) {
                        q.simulation.setInterface(instanceId, render);
                        this.needsUpdate = false;
                    }
                }
            },

            three: {
                content: "three-frame",
                menu_xml: "xml/menu_three.xml",
                toolbar_xml: "xml/toolbar_three.xml",
                created: false,
                needsUpdate: true,
                update: function(instanceId = 0, render = true) {
                    if (!this.created) {
                        createThreePopups();
                        this.created = true;
                    }
                    if (this.needsUpdate) {
                        q.three.setInterface(instanceId, render);
                        this.needsUpdate = false;
                    }
                }
            },

            model: {
                content: "model-frame",
                menu_xml: "xml/menu_model.xml",
                toolbar_xml: "xml/toolbar_model.xml",
                created: false,
                needsUpdate: true,
                update: function(instanceId = 0, render = true) {
                    if (!this.created) {
                        createModelPopups();
                        this.created = true;
                    }
                    if (this.needsUpdate) {
                        q.model.setInterface(instanceId, render);
                        this.needsUpdate = false;
                    }
                }
            },

            loadMenu: function(view) {
                return new Promise((resolve, reject) => {
                    app.views[view].menu = app.layout.cells("a").attachMenu({
                        icons_path: "img/icons/",
                        open_mode: "win",
                        xml: app.views[view].menu_xml,
                        top_text: '<div class="user-profile-button"></div>',
                        onload: function() {
                            app.views[view].menu.attachEvent("onClick", menuClick);
                            resolve();
                        }
                    });
                });
            },

            loadToolbar: function(view) {
                return new Promise((resolve, reject) => {
                    app.views[view].toolbar = app.layout.cells("a").attachToolbar({
                        icons_path: "img/icons/",
                        xml: app.views[view].toolbar_xml,
                        onload: function() {
                            app.views[view].toolbar.attachEvent("onStateChange", toolbarStateChange);
                            app.views[view].toolbar.attachEvent("onClick", toolbarClick);
                            resolve();
                        }
                    });
                });
            },

            load: function(view) {
                app.layout.cells("a").showView(view);
                app.layout.cells("a").attachObject(this[view].content);
                return new Promise(async(resolve, reject) => {
                    await app.views.loadMenu(view);
                    await app.views.loadToolbar(view);
                    app.views.active = view;
                    let frame = $("#" + view + "-frame");
                    app.frame.width = frame.width();
                    app.frame.height = frame.height();
                    app.views[view].update("onAppViewShow");
                    resolve();
                });
            },

            setLogo: function(view) {
                var menu = $(".dhx_cell_menu_def");
                menu.find("div[id*='app-logo-container']").html("<div id='app-logo'></div>");
                menu.find("div[id*='view-']").attr("data-selected", "0");
                menu.find("div[id*='view-" + view + "']").attr("data-selected", "1");
            },

            show: function(view) {
                if (app.views.active == view) return;
                app.popups.hide();
                app.layout.cells("a").showView(view);
                this.active = view;
                let frame = $("#" + view + "-frame");
                app.frame.width = frame.width();
                app.frame.height = frame.height();
                app.views[view].update("onAppViewShow");
                Status.switchTo(view);
                this.setLogo(view);
                $(".user-profile-button").text(q.user.current.email);
                console.log(q.user);
            },

            update: function() {
                ["graph", "artwork", "simulation", "three", "model"].forEach(view => {
                    app.views[view].needsUpdate = true;
                });
                let view = app.views.active;
                let frame = $("#" + view + "-frame");
                app.frame.width = frame.width();
                app.frame.height = frame.height();
                app.views[view].needsUpdate = true;
                app.views[view].update();
            }

        },

        project: {

            created: getDate("short"),
            get author() { return q.user.displayName; },
            email: "",

            _notes: "",
            set notes(text) {
                text = String(text);
                text = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                text = text.trim();
                this._notes = text;
            },
            get notes() {
                return this._notes;
            },

            _title: "Untitled Project",
            set title(text) {
                text = String(text);
                text = text.replace(/[^a-zA-Z0-9_-]+|\s+/gmi, " ");
                text = text.replace(/ +/g, " ");
                text = text.trim();
                if (text !== this._title) {
                    this._title = text === "" ? "Untitled Project" : text;
                }
                document.title = this._title + " - Wve";
            },
            get title() {
                return this._title;
            },

            open: function() {
                openFileDialog("wve", "Project").then(file => {
                    if (app.state.validate(file.text)) {
                        XWin.show("openProject", {
                            data: file.text,
                            file: file.name,
                            date: file.date
                        });
                    } else {
                        XWin.show("error");
                        XWin.notify("error", "warning", "Invalid Project File!");
                    }
                });
            },

            save: function() {
                app.saveFile(JSON.stringify(app.state.compile()), "project.wve");
            },

            openWif: function() {
                openFileDialog("wif", "WIF").then(file => {
                    if (WIF.isValid(file.text)) {
                        const projectCode = WIF.read(file.text);
                        XWin.show("openProject", {
                            data: projectCode,
                            file: file.name,
                            date: file.date
                        });
                    } else {
                        XWin.show("error");
                        XWin.notify("error", "warning", "Invalid WIF File!");
                    }
                });
            },

            saveWif: function() {
                let wifContent = WIF.write(app.state.compile("wif"));
                app.saveFile(wifContent, "project.wif");
            },

            print: function(downloadAsImage = false) {
                Pdf.make({
                    origin: app.origin,
                    tieup: q.graph.get("tieup"),
                    threading: q.graph.get("threading"),
                    lifting: q.graph.get("lifting"),
                    weave: q.graph.get("weave"),
                    warp: q.pattern.warp,
                    weft: q.pattern.weft,
                    palette: q.palette.colors,
                    drawStyle: gp.drawStyle,
                    liftingMode: q.graph.liftingMode,
                    floats: Floats.count(q.graph.get("weave")),
                    projectTitle: app.project.title,
                    projectAuthor: app.project.author,
                    projectNotes: app.project.notes,
                    majorEvery: gp.showMajorGrid ? gp.majorGridEvery : 0
                });
            }

        },

        ui: {

            minDragger: 24,

            minTieupS: 96,
            maxTieupS: 384,

            patternSpan: 20,
            space: 2,
            shadow: 2,
            shadowHex: "#666",
            focusShadowHex: "#000",

            grid: {
                light: rgbaToColor32(160, 160, 160),
                dark: rgbaToColor32(80, 80, 80)
            },

            check: {
                light: rgbaToColor32(232, 232, 232),
                dark: rgbaToColor32(216, 216, 216)
            },

            // app.ui.load
            load: async function(instanceId) {

                let mot = $('#mo-text');

                mot.text('Connecting Server');

                // Firebase setup check
                if (typeof firebase == undefined) {
                    mot.text('Error connecting server!').addClass('mo-error');
                    return;
                }

                // Authentication
                mot.text('Authenticating');
                q.user.init();
                let user = await q.user.load();
                if (!user) {
                    mot.text('Authenticating failed!').addClass('mo-error');
                    q.user.onLogout();
                    return;
                }
                $('#mo-fill').css({'width': '20%'});
                $('#mo-email').text(q.user.current.email);
                $('#mo-email-container').fadeIn();
                $(document).on("click", "#mo-signout", function() {
                    q.user.onLogout();
                });

                // Firestore check
                let appStatus = await app.checkFirestoreAppStatus();
                if (!appStatus) {
                    mot.text('Server not accessible!').addClass('mo-error');
                    return;
                }
                $('#mo-fill').css({'width': '40%'});

                // Subscription Check
                mot.text('Verifying subscription');
                let userData = await q.user.data;
                if (!userData) {
                    mot.text('Subscription error!').addClass('mo-error');
                    return;

                } else {
                    let subscriptionRemaining = userData.subscription.remainingDays;
                    if (subscriptionRemaining <= 0) {
                        mot.text('Subscription expired!').addClass('mo-error');
                        return;
                    }

                }
                $('#mo-fill').css({'width': '60%'});

                // Create Layout
                app.layout = new dhtmlXLayoutObject(layoutData);
                $('#statusbar-frame').show();
                app.layout.attachFooter("statusbar-frame");

                // Fetch UI Data
                mot.text('Fetching UI Data');
                await app.contextMenu.load("palette");
                await app.contextMenu.load("pattern");
                await app.contextMenu.load("tools");
                await app.contextMenu.load("selection");
                await app.contextMenu.load("weave");
                $('#mo-fill').css({'width': '80%'});

                mot.text('Creating Interface');
                await app.views.load("graph");
                $('#mo-fill').css({'width': '84%'});
                await app.views.load("artwork");
                $('#mo-fill').css({'width': '88%'});
                await app.views.load("simulation");
                $('#mo-fill').css({'width': '92%'});
                await app.views.load("three");
                $('#mo-fill').css({'width': '96%'});
                await app.views.load("model");
                $('#mo-fill').css({'width': '100%'});

                q.user.setPermissions(userData);

                $(document).on("click", ".user-profile-button", function(evt) {
                    XWin.show("userProfile");
                });

                app.history.off();

                app.views.show("graph");
                q.palette.createLayout();
                app.colorPicker.create();
                app.anglePicker.create();

                await app.wins.yarns.loadSystemItems();

                app.config.restore();

                if (!app.state.restore()) app.autoProject();

                // localforage.getItem('somekey').then(function(value) {
                //     // This code runs once the value has been loaded
                //     // from the offline store.
                //     console.log(value);
                // }).catch(function(err) {
                //     // This code runs if there were any errors
                //     console.log(err);
                // });

                q.graph.needsUpdate(60);
                q.pattern.needsUpdate(5);
                q.palette.selectChip("a");

                if (mp.bgType == "image") mp.bgType = "solid";
                if (tp.bgType == "image") tp.bgType = "solid";

                app.history.setup();
                app.history.on();
                // app.history.record("startup", ...app.state.historyItems);

                fb.registerEvents();

                documentEventsInit();

                Debug.item("Frame Width", app.frame.width);
                Debug.item("Frame Height", app.frame.height);
                Debug.item("devicePixelRatio", window.devicePixelRatio);

                $(document).on("change", ".xcheckbox[data-show-element]", function() {
                    var es = $(this).attr("data-show-element");
                    var show = $(this).prop("checked");
                    var showElements = es.split(",");
                    showElements.forEach(function(e) {
                        if (show) {
                            $("#" + e).show();
                        } else {
                            $("#" + e).hide();
                        }
                    });
                });

                $(document).on("change", ".xcheckbox[data-hide-element]", function() {
                    var es = $(this).attr("data-hide-element");
                    var hide = $(this).prop("checked");
                    var hideElements = es.split(",");
                    hideElements.forEach(function(e) {
                        if (hide) {
                            $("#" + e).hide();
                        } else {
                            $("#" + e).show();
                        }
                    });
                });

                app.layout.attachEvent("onResizeFinish", function() {
                    Debug.item("Frame Width", app.frame.width);
                    Debug.item("Frame Height", app.frame.height);
                    app.views.update();
                    XWin.reposition();
                });

                $("#mo").fadeOut(1000);

                app.requestAnimationFrame();

                q.user.bindFirestoreEvents();

            }
        },

        wins: {

            list: [],
            activeModalId: false,

            projects: {
                title: "Project Library",
                width: 240,
                height: 365,
                top: 140,
                right: 30,
                type: "tabbar",
                tabs: {
                    system: {
                        type: "library",
                        needsUpdate: true,
                        domNeedsUpdate: true,
                        dataNeedsUpdate: true,
                        url: "json/library_project_system.json"
                    },
                    user: {
                        type: "library",
                        domNeedsUpdate: true,
                        dataNeedsUpdate: true,
                        needsUpdate: true
                    }
                },
                needsUpdate: true,
                dataNeedsUpdate: true,
                domNeedsUpdate: true,
                userButton: "reload",
                onReady: function() {},
                onShow: function() {}
            },

            weaves: {
                title: "Weave Library",
                width: 240,
                height: 365,
                top: 200,
                right: 70,
                type: "tabbar",
                get items() {
                    return q?.graph?.weaves;
                },
                tabs: {
                    system: {
                        counter: 0,
                        type: "library",
                        needsUpdate: true,
                        domNeedsUpdate: true,
                        dataNeedsUpdate: true,
                        url: "json/library_weave_system.json"
                    },
                    user: {
                        counter: 0,
                        type: "library",
                        needsUpdate: true,
                        domNeedsUpdate: true,
                        dataNeedsUpdate: true
                    }
                },
                needsUpdate: true,
                dataNeedsUpdate: true,
                domNeedsUpdate: true,
                userButton: "reload",
                onReady: function() {},
                onShow: function() {},
                onUserButton: async function(id, tab = "system") {
                    if (tab !== "system") return;
                    app.wins.weaves.tabs[tab].dataNeedsUpdate = true;
                    XWin.render("onUserButton2", "weaves", tab);
                },
                addJSONItems: function(json, tab = "system") {
                    let _this = this;
                    if (!json) return;
                    this.clearSystemItems();
                    json.forEach(function(item, i) {
                        let weave2D8 = weaveTextToWeave2D8(item.weave);
                        _this.addItem(tab, item.title, weave2D8);
                    });
                },
                clearSystemItems: function() {
                    let object = q.graph.weaves;
                    for (const key in object) {
                        if (Object.hasOwnProperty.call(object, key) && object[key].tab == "system") {
                            delete object[key];
                        }
                    }
                    this.tabs.system.counter = 0;
                },
                clearUserItems: function() {
                    let object = q.graph.weaves;
                    for (const key in object) {
                        if (Object.hasOwnProperty.call(object, key) && object[key].tab == "user") {
                            delete object[key];
                        }
                    }
                    this.tabs.user.counter = 0;
                },
                addItem: function(tab, title, weave2D8, saveState = true) {
                    let counter = this.tabs[tab].counter++;
                    let id = tab + "_" + counter;
                    q.graph.weaves[id] = {
                        title: title,
                        info: weave2D8.length + " \xD7 " + weave2D8[0].length,
                        thumb: weave2D8ToDataURL(weave2D8, 96, 96, q.upColor32, 8, 8),
                        weave2D8: weave2D8,
                        tab: tab,
                        edit_button_class: "btn-edit-weave",
                        copy: true,
                        delete: tab == "user" ? true : false
                    };
                    app.wins.weaves.tabs[tab].domNeedsUpdate = true;
                    if (tab == "user" && saveState) {
                        app.history.record("onWeavesAddItem", "weaves");
                        XWin.scrollTo("weaves.user", "bottom");
                    }
                },
                removeItem: function(itemId) {
                    if (q.graph.weaves[itemId] == undefined) {
                        app.alert("red", "Error", "Unable to delete!");
                        return;
                    }
                    delete q.graph.weaves[itemId];
                    this.tabs.user.domNeedsUpdate = true;
                    app.history.record("onWeavesAddItem", "weaves");
                }
            },

            yarns: {
                title: "Yarn Library",
                width: 240,
                height: 365,
                top: 190,
                right: 80,
                type: "tabbar",
                get items() {
                    return q?.graph?.yarns;
                },
                setData: function(id, param, value) {
                    q.graph.yarns[id][param] = value;
                },
                tabs: {
                    system: {
                        counter: 0,
                        type: "library",
                        needsUpdate: true,
                        domNeedsUpdate: true,
                        dataNeedsUpdate: true,
                        url: "json/library_yarn_system.json"
                    },
                    user: {
                        counter: 0,
                        type: "library",
                        needsUpdate: true,
                        domNeedsUpdate: true,
                        dataNeedsUpdate: true
                    }
                },
                needsUpdate: true,
                dataNeedsUpdate: true,
                domNeedsUpdate: true,
                userButton: "reload",
                onReady: async function() {},
                onShow: function() {},
                onUserButton: async function(id, tab = "system") {
                    if (tab !== "system") return;
                    app.wins.yarns.tabs[tab].dataNeedsUpdate = true;
                    await this.loadSystemItems();
                    XWin.render("onUserButton2", "yarns", tab);
                },
                loadSystemItems: async function() {
                    let _this = this;
                    return new Promise(async(resolve, reject) => {
                        if (!_this.tabs.system.dataNeedsUpdate) return resolve();
                        let json = await XWin.getLibraryJson("yarns", "system");
                        _this.addJSONItems(json);
                        _this.tabs.system.dataNeedsUpdate = false;
                        resolve();
                    });
                },
                addJSONItems: function(json, tab = "system") {
                    let _this = this;
                    if (!json) return;
                    this.clearSystemItems();
                    json.forEach(function(item, i) {
                        _this.addItem(tab, item);
                    });
                    XWin.render("onAddItem", "yarns", tab);
                },
                clearSystemItems: function() {
                    let object = q.graph.yarns;
                    for (const key in object) {
                        if (Object.hasOwnProperty.call(object, key) && object[key].tab == "system") {
                            delete object[key];
                        }
                    }
                    this.tabs.system.counter = 0;
                },
                clearUserItems: function() {
                    let object = q.graph.yarns;
                    for (const key in object) {
                        if (Object.hasOwnProperty.call(object, key) && object[key].tab == "user") {
                            delete object[key];
                        }
                    }
                    this.tabs.user.counter = 0;
                },
                addItem: function(tab, props, saveState = true) {
                    let id;
                    if (props.id == undefined) {
                        let counter = gop(props, "id", this.tabs[tab].counter++);
                        id = tab + "_" + counter;
                        props.id = id;
                    } else {
                        id = props.id;
                    }
                    props.tab = tab;
                    props.info = props.number + " " + toTitleCase(props.number_system) + ", " + toTitleCase(props.profile) + ", " + toTitleCase(props.structure);
                    props.edit = true;
                    props.delete = tab == "user";
                    props.duplicate = true;
                    props.edit_button_class = "btn-edit-yarn";
                    q.graph.yarns[id] = props;
                    app.wins.yarns.tabs[tab].domNeedsUpdate = true;
                    if (tab == "user" && saveState) {
                        app.history.record("onYarnsAddItem", "yarns");
                        XWin.scrollTo("yarns.user", "bottom");
                    }
                },
                removeItem: function(itemId) {
                    if (q.graph.yarns[itemId] == undefined) {
                        app.alert("red", "Error", "Unable to delete!");
                        return;
                    }
                    delete q.graph.yarns[itemId];
                    this.tabs.user.domNeedsUpdate = true;
                    app.history.record("onWeavesAddItem", "yarns");
                }
            },

            artworkColors: {
                title: "Artwork Colors",
                width: 240,
                height: 365,
                top: 120,
                right: 300,
                type: "library",
                needsUpdate: true,
                dataNeedsUpdate: true,
                domNeedsUpdate: true,
                userButton: "reload",
                onReady: function() {},
                onShow: function() {}
            },

            models: {
                title: "Model Library",
                width: 240,
                height: 365,
                top: 150,
                right: 60,
                type: "library",
                get items() {
                    return q?.model?.models;
                },
                url: "json/library_model_system.json",
                needsUpdate: true,
                dataNeedsUpdate: true,
                domNeedsUpdate: true,
                userButton: "reload",
                onReady: function() {},
                onShow: function() {},
                onUserButton: function(id, tab) {
                    if (tab !== "system") return;
                    app.wins.models.dataNeedsUpdate = true;
                    XWin.render("onUserButton", "models");
                },
                addJSONItems: function(json, tab = "system") {
                    let _this = this;
                    if (!json) return;
                    if (this.counter == undefined) this.counter = 0;
                    json.forEach(function(item) {
                        let id = _this.counter++;
                        item.info = item.UVMapWmm + "mm \xD7 " + item.UVMapWmm + "mm2";
                        item.edit_button_class = "btn-edit-model";
                        let thumb = gop(item, "thumb_data", false);
                        if (!thumb) {
                            let thumb_dir = "model/objects/";
                            thumb = gop(item, "thumb_image", false);
                            thumb = thumb ? thumb_dir + thumb : thumb_dir + "unavailable.png";
                        }
                        item.thumb = thumb;
                        q.model.models[id] = item;
                    });
                }
            },

            materials: {
                title: "Material Library",
                width: 240,
                height: 365,
                top: 90,
                right: 30,
                type: "tabbar",
                get items() {
                    return q?.model?.materials;
                },
                data: undefined,
                counter: {
                    color: 0,
                    image: 0,
                    weave: 0
                },
                tabs: {
                    system: {
                        type: "library",
                        url: "json/library_material_system.json",
                        dataNeedsUpdate: true,
                        domNeedsUpdate: true
                    },
                    user: {
                        type: "library",
                        dataNeedsUpdate: true,
                        domNeedsUpdate: true
                    }
                },
                needsUpdate: true,
                userButton: "reload",
                onReady: function() {},
                onShow: function() {},
                onUserButton: async function(id, tab) {
                    if (tab !== "system") return;
                    app.wins.materials.tabs[tab].dataNeedsUpdate = true;
                    await this.loadSystemItems();
                    XWin.render("onUserButton2", "materials", tab);
                },
                loadSystemItems: async function() {
                    let _this = this;
                    return new Promise(async(resolve, reject) => {
                        let json = await XWin.getLibraryJson("materials", "system");
                        _this.addJSONItems(json);
                        resolve();
                    });
                },
                addJSONItems: function(json, tab = "system") {
                    let _this = this;
                    if (!json) return;
                    json.forEach(function(item) {
                        item.tab = tab;
                        item.edit_button_class = "btn-edit-material";
                        item.needsUpdate = true;
                        item.edit = true;
                        q.model.setMaterial(item.name, item);
                    });
                }
            },

            stripeResize2: {

                title: "Resize Stripe",
                width: 180,
                height: 120,
                domId: "stripe-resize-modal",
                onShow: function() {

                    var yarnSet = q.pattern.rightClick.yarnSet;
                    var threadNum = q.pattern.rightClick.threadNum;
                    var stripe = q.pattern.stripeAt(yarnSet, threadNum - 1);
                    // console.log(stripe);
                    var maxStripeSize = q.limits.maxPatternSize - q.pattern[yarnSet].length + stripe.size;
                    var input = $("#stripe-size input");
                    input.val(stripe.size);
                    input.attr("data-min", 1);
                    input.attr("data-max", maxStripeSize);
                    input.attr("data-yarn-set", yarnSet);
                    input.attr("data-thread-num", stripe.start + 1);

                },
                primary: function() {

                    var input = $("#stripe-size input");
                    var yarnSet = input.attr("data-yarn-set");
                    var threadNum = input.attr("data-thread-num");
                    var newStripeSize = input.num();
                    var stripe = q.pattern.stripeAt(yarnSet, threadNum - 1);
                    if (newStripeSize !== stripe.size) {
                        q.pattern.delete(yarnSet, stripe.start, stripe.end);
                        q.pattern.insert(yarnSet, stripe.val, stripe.start, newStripeSize);
                    }
                    // this.onShow();
                }
            },

            patternScale: {
                title: "Pattern Scale",
                width: 200,
                height: 170,
                domId: "pattern-scale-modal",
                onShow: function() {
                    var sppi = $("#scalePatternWarp input");
                    var sfpi = $("#scalePatternWeft input");
                    sppi.attr("data-max", q.limits.maxPatternSize);
                    sppi.attr("data-min", 1);
                    sfpi.attr("data-max", q.limits.maxPatternSize);
                    sfpi.attr("data-min", 1);
                    sppi.val(q.pattern.size("warp"));
                    sfpi.val(q.pattern.size("weft"));
                },
                primary: function() {
                    var [ends, picks] = [q.pattern.warp.length, q.pattern.weft.length];
                    var newWarp = "";
                    var newWeft = "";
                    var newEnds = ev("#scalePatternWarp input");
                    var newPicks = ev("#scalePatternWeft input");
                    var preserveStripes = ev("#scalePatternPreserveStripes");
                    if (preserveStripes) {
                        var newStripeSize;
                        var warpPatternGroups = getPatternGroupArray(q.pattern.warp);
                        var weftPatternGroups = getPatternGroupArray(q.pattern.weft);
                        $.each(warpPatternGroups, function(index, [alpha, num]) {
                            newStripeSize = Math.max(1, Math.round(num * newEnds / ends));
                            newWarp = newWarp + alpha.repeat(newStripeSize);
                        });
                        $.each(weftPatternGroups, function(index, [alpha, num]) {
                            newStripeSize = Math.max(1, Math.round(num * newPicks / picks));
                            newWeft += alpha.repeat(newStripeSize);
                        });
                    } else {
                        newWarp = q.pattern.warp.scale(newEnds);
                        newWeft = q.pattern.weft.scale(newPicks);
                    }
                    app.history.off();
                    q.pattern.set(7, "warp", newWarp, false);
                    q.pattern.set(8, "weft", newWeft, true);
                    app.history.on();
                    app.history.record("patternScale", "warp", "weft");
                    this.onShow();
                }
            },

            patternTile: {
                title: "Pattern Tile",
                width: 200,
                height: 170,
                domId: "pattern-tile-modal",
                onShow: function() {
                    $("#tilePatternWarp").num(1).attr({
                        "data-min": 1,
                        "data-max": Math.floor(q.limits.maxWeaveSize / q.pattern.warp.length)
                    });
                    $("#tilePatternWeft").num(1).attr({
                        "data-min": 1,
                        "data-max": Math.floor(q.limits.maxWeaveSize / q.pattern.weft.length)
                    });
                },
                primary: function() {
                    var wpTiles = ev("#tilePatternWarp input");
                    var wfTiles = ev("#tilePatternWeft input");
                    var newWarp = q.pattern.warp.repeat(wpTiles);
                    var newWeft = q.pattern.weft.repeat(wfTiles);
                    app.history.off();
                    q.pattern.set(7, "warp", newWarp, false);
                    q.pattern.set(8, "weft", newWeft, true);
                    app.history.on();
                    app.history.record("patternTile", "warp", "weft");
                    this.onShow();
                }
            },

            artworkTile: {
                title: "Artwork Tile",
                width: 200,
                height: 170,
                domId: "artwork-tile-modal",
                onShow: function() {
                    let maxS = q.limits.maxArtworkSize;
                    $("#tileArtworkX").num(1).attr({
                        "data-min": 1,
                        "data-max": Math.floor(maxS / q.artwork.width)
                    });
                    $("#tileArtworkY").num(1).attr({
                        "data-min": 1,
                        "data-max": Math.floor(maxS / q.artwork.height)
                    });
                },
                primary: function() {
                    var xTiles = ev("#tileArtworkX input");
                    var yTiles = ev("#tileArtworkY input");
                    var newW = q.artwork.width * xTiles;
                    var newH = q.artwork.height * yTiles;
                    this.onShow();
                }
            },

            weaveLibraryAdd: {
                title: "Add Weave to Library",
                width: 360,
                height: 300,
                domId: "weave-library-add-win",
                modal: true,
                onShow: function(weave2D8) {
                    this.weave2D8 = weave2D8;
                    var weaveProps = getWeaveProps(weave2D8);
                    var sizeInfo = weave2D8.length + " \xD7 " + weave2D8[0].length;
                    var shaftInfo = weaveProps.inLimit ? weaveProps.shafts : ">" + q.limits.maxShafts;
                    $("#weave-library-add-title").val("Untitled Weave");
                    $("#weave-library-add-size").val(sizeInfo);
                    $("#weave-library-add-shafts").val(shaftInfo);
                },
                primary: function() {
                    app.wins.weaves.addItem("user", $("#weave-library-add-title").val(), this.weave2D8);
                    XWin.hide("weaveLibraryAdd");
                    XWin.show("weaves.user");
                }
            },

            userProfile: {
                title: "User Profile",
                width: 300,
                height: 400,
                domId: "user-profile-modal",
                modal: true,
                onShow: async function() {
                    let user = q.user.current;
                    $("#user-profile-id").val(user.email);
                    $("#user-author-name").val(user.displayName);
                    $("#user-joined-date").val(user.metadata.creationTime);
                    $("#user-subscription-plan").val("...");
                    $("#user-subscription-expiry").val("...");
                    $("#user-subscription-remaining").val("...");
                    let userData = await q.user.data;
                    if (userData) {
                        $("#user-subscription-plan").val(userData.plan.toUpperCase());
                        $("#user-subscription-expiry").val(userData.subscription.expiry);
                        $("#user-subscription-remaining").val(userData.subscription.remaining);
                    }
                },
                primary: function() {
                    let user = q.user.current;
                    let authorName = user.displayName;
                    let newAuthorName = $("#user-author-name").val();
                    newAuthorName = String(newAuthorName);
                    newAuthorName = newAuthorName.replace(/[^a-zA-Z0-9_-]+|\s+/gmi, " ");
                    newAuthorName = newAuthorName.replace(/ +/g, " ");
                    newAuthorName = newAuthorName.trim();
                    if (newAuthorName !== authorName) {
                        q.user.displayName = newAuthorName;
                    }
                },
                secondary: async function() {
                    let doSignOut = await app.confirm("red", "Sign Out", `Are you sure you want to sign out?`);
                    if (doSignOut) {
                        q.user.onLogout();
                    }
                }
            },

            newProject: {
                title: "New Project",
                width: 360,
                height: 360,
                domId: "project-new-modal",
                modal: true,
                onShow: function() {
                    $("#project-new-title").val("Untitled Project");
                    $("#project-new-date").val(getDate("short"));
                    $("#project-new-author").val(app.project.author);
                    $("#project-new-notes").val("");
                    XWin.notify("newProject", "warning", "Starting a new project will clear Weave, Threading, Lifting, Tieup and Patterns.");
                },
                primary: function() {
                    app.history.off();
                    q.pattern.set(3, "warp", "a", false);
                    q.pattern.set(4, "weft", "b", false);
                    q.graph.set(0, "weave", weaveTextToWeave2D8("UD_DU"));
                    app.project.created = ev("#project-new-date");
                    app.project.title = ev("#project-new-title");
                    app.project.notes = ev("#project-new-notes");
                    app.history.on();
                    app.history.record("newProject", ...app.state.recordItems);
                    XWin.hide("newProject");
                }
            },

            projectProperties: {
                title: "Project Properties",
                width: 360,
                height: 300,
                domId: "project-properties-modal",
                modal: true,
                onShow: function() {
                    $("#project-properties-title").val(app.project.title);
                    $("#project-properties-date").val(app.project.created);
                    $("#project-properties-author").val(app.project.author);
                    $("#project-properties-notes-textarea").val(app.project.notes);
                },
                primary: function() {
                    app.project.title = ev("#project-properties-title");
                    app.project.notes = ev("#project-properties-notes-textarea");
                    app.history.record("projectProperties", "title", "notes");
                    XWin.hide("projectProperties");
                }
            },

            openProjectCode: {
                title: "Open Project Code",
                width: 360,
                height: 300,
                domId: "project-open-code-modal",
                modal: true,
                onShow: function() {
                    $("#project-open-code-textarea").val("");
                },
                primary: function() {
                    var projectData = ev("#project-open-code-textarea");
                    XWin.hide("openProjectCode");
                    XWin.show("openProject", {
                        file: 'Text contents',
                        data: projectData
                    });
                }
            },

            saveSimulation: {
                title: "Save Simulation",
                width: 240,
                height: 360,
                domId: "simulation-save-modal",
                modal: true,

                updateWith: function(id) {

                    var i = {
                        rx: "simulation-save-xrepeats",
                        ry: "simulation-save-yrepeats",
                        tx: "simulation-save-xthreads",
                        ty: "simulation-save-ythreads",
                        px: "simulation-save-xpixels",
                        py: "simulation-save-ypixels",
                        dx: "simulation-save-xdimension",
                        dy: "simulation-save-ydimension",
                        nx: "simulation-save-xdensity",
                        ny: "simulation-save-ydensity",
                        ex: "simulation-save-xexport",
                        ey: "simulation-save-yexport"
                    };

                    var e = {};
                    var v = {};
                    var is = {};

                    for (let key in i) {
                        if (i.hasOwnProperty(key)) {
                            e[key] = $("#" + i[key]);
                            v[key] = e[key].num();
                            is[key] = i[key] == id;
                        }
                    }

                    var xThreads;

                    var isX = is.rx || is.tx || is.dx || is.px;
                    var isY = is.ry || is.ty || is.dy || is.py;

                    if (isX) {
                        if (is.rx) v.tx = v.rx * q.graph.colorRepeat.warp;
                        if (is.dx) v.tx = v.dx / q.simulation.intersection.width.mm;
                        if (is.px) v.tx = v.px / q.simulation.intersection.width.px;

                        if (!is.tx) e.tx.num(v.tx, 1);
                        if (!is.rx) e.rx.num(v.tx / q.graph.colorRepeat.warp, 1);
                        if (!is.dx) e.dx.num(v.tx * q.simulation.intersection.width.mm, 1);
                        if (!is.px) e.px.num(v.tx * q.simulation.intersection.width.px, 0);
                        e.ex.num(v.tx * q.simulation.intersection.width.px, 0);
                    }

                    if (isY) {
                        if (is.ry) v.ty = v.ry * q.graph.colorRepeat.weft;
                        if (is.dy) v.ty = v.dy / q.simulation.intersection.height.mm;
                        if (is.py) v.ty = v.py / q.simulation.intersection.height.px;

                        if (!is.ty) e.ty.num(v.ty, 1);
                        if (!is.ry) e.ry.num(v.ty / q.graph.colorRepeat.weft, 1);
                        if (!is.dy) e.dy.num(v.ty * q.simulation.intersection.height.mm, 1);
                        if (!is.py) e.py.num(v.ty * q.simulation.intersection.height.px, 0);
                        e.ey.num(v.ty * q.simulation.intersection.height.px, 0);
                    }

                },

                onReady: function() {
                    let _this = this;
                    $(".simulation-save-input").keyup(function() {
                        if (isNaN($("#" + this.id).num())) return;
                        _this.updateWith(this.id);
                    });
                },

                onShow: function() {
                    $("#simulation-save-xrepeats").val(1);
                    $("#simulation-save-yrepeats").val(1);
                    $("#simulation-save-quality").val(1);
                    $("#simulation-save-scale").val(1);
                    this.updateWith("simulation-save-xrepeats");
                    this.updateWith("simulation-save-yrepeats");
                },

                primary: function() {

                    var xPixels = ev("#simulation-save-xpixels");
                    var yPixels = ev("#simulation-save-ypixels");
                    var xExport = ev("#simulation-save-xexport");
                    var yExport = ev("#simulation-save-yexport");
                    q.simulation.renderToExport(xPixels, yPixels, xExport, yExport);

                }
            },

            patternCode: {
                title: "Pattern Code",
                width: 360,
                height: 300,
                domId: "pattern-code-modal",
                modal: false,
                onShow: function() {
                    $("#pattern-code-warp").val(compress1D(q.pattern.warp));
                    $("#pattern-code-weft").val(compress1D(q.pattern.weft));
                },
                primary: function() {
                    app.history.off();
                    q.pattern.set(1, "warp", decompress1D(ev("#pattern-code-warp")));
                    q.pattern.set(2, "weft", decompress1D(ev("#pattern-code-weft")));
                    app.history.on();
                    app.history.record("patternCode", "warp", "weft");
                }
            },

            weaveCode: {
                title: "Weave Code",
                width: 360,
                height: 300,
                domId: "weave-code-modal",
                modal: false,
                onShow: function(code) {
                    $("#weave-code").val(code);
                },
                primary: function() {
                    q.graph.set(111, graph, weaveTextToWeave2D8(ev("#weave-code")));
                }
            },

            threadingCode: {
                id: "threadingCode",
                title: "Threading Code",
                width: 360,
                height: 300,
                domId: "threading-code-modal",
                modal: false,
                onShow: function() {
                    $("#graph-code-threading").val(q.graph.threading1D.join(","));
                },
                primary: function() {

                    var graph = "threading";

                    var text = String(ev("#graph-code-" + graph));
                    var arr1D = text.split(",");
                    XWin.clearNotify(this.id);
                    if (Math.min(...arr1D) >= 1 && Math.max(...arr1D) <= q.limits.maxShafts) {
                        var arr2D8 = threading1D_threading2D8(arr1D);
                        q.graph.set(111, graph, arr2D8);
                    } else {
                        XWin.notify(this.id, "warning", "Invalid Code");
                    }

                }
            },

            treadlingCode: {
                id: "treadlingCode",
                title: "Treadling Code",
                width: 360,
                height: 300,
                domId: "treadling-code-modal",
                modal: false,
                onShow: function() {
                    $("#graph-code-treadling").val(q.graph.treadling1D.join(","));
                },
                primary: function() {

                    var graph = "treadling";

                    var text = String(ev("#graph-code-" + graph));
                    var arr1D = text.split(",");
                    XWin.clearNotify(this.id);
                    if (Math.min(...arr1D) >= 1 && Math.max(...arr1D) <= q.limits.maxShafts) {
                        var arr2D8 = threading1D_threading2D8(arr1D).rotate2D8("l").flip2D8("x");
                        q.graph.set(111, "lifting", arr2D8);
                    } else {
                        XWin.notify(this.id, "warning", "Invalid Code");
                    }

                }
            },

            openProject: {
                title: "Open Project",
                width: 360,
                height: 480,
                domId: "project-partial-open-modal",
                modal: true,
                onShow: function(params) {
                    this.data = params.data;
                    var project = JSON.parse(this.data);
                    let template = {
                        time: false,
                        author: false,
                        email: false,
                        version: false,
                        title: false,
                        notes: false,
                        palette: false,
                        warp: false,
                        weft: false,
                        weave: false,
                        ends: false,
                        picks: false,
                        threading: false,
                        treadling: false,
                        liftplan: false,
                        tieup: false,
                        treadles: false,
                        shafts: false,
                        artwork: false,
                        configs: false,
                        paletteEntries: false,
                        warpPatternThreads: false,
                        weftPatternThreads: false,
                        warpColorCount: false,
                        weftColorCount: false,
                        fabricColorCount: false,
                        weaves: false,
                        yarns: false,
                        mergeWeaves: false,
                        mergeYarns: false
                    };

                    for (let item in template) {
                        project[item] = gop(project, item, false) || false;
                    }

                    let title = gop(project, "title", "") || "";
                    let author = gop(project, "author", "") || "";
                    let notes = gop(project, "notes", "") || "";

                    let modified = gop(params, "date", false);
                    let time = gop(project, "time", false) || modified;

                    let date = "";

                    if (time) {
                        date = new moment(time);
                        date = date.format("MMMM D, YYYY");
                    }

                    $("#project-open-file-name").val(params.file);
                    $("#project-open-title").val(title);
                    $("#project-open-author").val(author);
                    $("#project-open-date").val(date);
                    $("#project-open-notes").val(notes);

                    let ends = gop(project, "ends", "-") || "-";
                    let picks = gop(project, "picks", "-") || "-";
                    let shafts = gop(project, "shafts", "-") || "-";
                    let treadles = gop(project, "treadles", "-") || "-";
                    let paletteEntries = gop(project, "paletteEntries", "-") || "-";
                    let palette = gop(project, "palette", false);
                    if (palette) paletteEntries = palette.length;

                    $("#project-open-threading-ends").text(ends);
                    $("#project-open-lifting-picks").text(picks);
                    $("#project-open-shafts").text(shafts);
                    $("#project-open-treadles").text(treadles);
                    $("#project-open-palette-entries").text(paletteEntries);

                    let warpPatternThreads = gop(project, "warpPatternThreads", "-") || "-";
                    let weftPatternThreads = gop(project, "weftPatternThreads", "-") || "-";
                    let warpColorCount = gop(project, "warpColorCount", "-") || "-";
                    let weftColorCount = gop(project, "weftColorCount", "-") || "-";
                    let fabricColorCount = gop(project, "fabricColorCount", "-") || "-";

                    let warp = gop(project, "warp", false);
                    let weft = gop(project, "weft", false);

                    let warpPattern = "";
                    let weftPattern = "";

                    if (warp) {
                        warpPattern = decompress1D(warp);
                        warpPatternThreads = warpPattern.length;
                        warpColorCount = warpPattern.split("").unique().length;
                    }

                    if (weft) {
                        weftPattern = decompress1D(weft);
                        weftPatternThreads = weftPattern.length;
                        weftColorCount = weftPattern.split("").unique().length;
                    }

                    if (warp && weft) {
                        fabricColorCount = (warpPattern + weftPattern).split("").unique().length;
                    }

                    $("#project-open-warp-pattern").text(warpPatternThreads);
                    $("#project-open-weft-pattern").text(weftPatternThreads);
                    $("#project-open-warp-colors").text(warpColorCount);
                    $("#project-open-weft-colors").text(weftColorCount);
                    $("#project-open-fabric-colors").text(fabricColorCount);

                    for (let item in project) {
                        if (project[item] !== undefined && project[item]) {
                            $("#project-import-" + item).show();
                            $("#project-import-" + item).prop("checked", true);
                            $("#project-import-" + item).siblings('.xicon-not-available').hide();
                        } else {
                            $("#project-import-" + item).prop("checked", false);
                            $("#project-import-" + item).hide();
                            $("#project-import-" + item).siblings('.xicon-not-available').show();
                        }
                    }

                    let yarnLibraryEntries = Object.keys(project.yarns).length;
                    let weaveLibraryEntries = Object.keys(project.weaves).length;

                    if (yarnLibraryEntries) $("#project-open-yarns").text(yarnLibraryEntries);
                    if (weaveLibraryEntries) $("#project-open-weaves").text(weaveLibraryEntries);

                    this.enableCheckbox('#project-import-yarns', yarnLibraryEntries);
                    this.enableCheckbox('#project-import-weaves', weaveLibraryEntries);

                    this.enableCheckbox('#project-merge-yarns', yarnLibraryEntries);
                    this.enableCheckbox('#project-merge-weaves', weaveLibraryEntries);

                },

                enableCheckbox: function(target, state) {
                    if (state) {
                        $(target).show();
                        $(target).prop("checked", true);
                        $(target).siblings('.xicon-not-available').hide();
                    } else {
                        $(target).hide();
                        $(target).prop("checked", false);
                        $(target).siblings('.xicon-not-available').show();
                    }
                },

                primary: function() {
                    var options;
                    options = {
                        palette: ev("#project-import-palette"),
                        warp: ev("#project-import-warp"),
                        weft: ev("#project-import-weft"),
                        weave: ev("#project-import-weave"),
                        threading: ev("#project-import-threading"),
                        treadling: ev("#project-import-treadling"),
                        liftplan: ev("#project-import-liftplan"),
                        tieup: ev("#project-import-tieup"),
                        artwork: ev("#project-import-artwork"),
                        weaves: ev("#project-import-weaves"),
                        yarns: ev("#project-import-yarns"),
                        config: ev("#project-import-configs"),
                        mergeWeaves: ev("#project-merge-weaves"),
                        mergeYarns: ev("#project-merge-yarns"),
                    };
                    app.state.set(2, JSON.parse(this.data), options);
                    app.history.record("onOpenProject", ...app.state.historyItems);
                    XWin.hide("openProject");
                }

            },

            error: {
                title: "Error",
                width: 360,
                height: 300,
                domId: "error-win",
                modal: false
            },

        },

        colors: {
            black32: rgbaToColor32(0, 0, 0),
            black5032: rgbaToColor32(0, 0, 0, 127),
            white32: rgbaToColor32(255, 255, 255),
            red32: rgbaToColor32(255, 0, 0),
            green32: rgbaToColor32(0, 255, 0),
            blue32: rgbaToColor32(0, 0, 255),
            grey32: rgbaToColor32(127, 127, 127),

            rgba: {
                black: {
                    r: 0,
                    g: 0,
                    b: 0,
                    a: 1
                },
                black50: {
                    r: 0,
                    g: 0,
                    b: 0,
                    a: 0.5
                },
                white: {
                    r: 255,
                    g: 255,
                    b: 255,
                    a: 1
                },
                red: {
                    r: 255,
                    g: 0,
                    b: 0,
                    a: 1
                },
                green: {
                    r: 0,
                    g: 255,
                    b: 0,
                    a: 1
                },
                blue: {
                    r: 0,
                    g: 0,
                    b: 255,
                    a: 1
                },
                grey: {
                    r: 127,
                    g: 127,
                    b: 127,
                    a: 1
                }
            },

            rgba255: {
                black: {
                    r: 0,
                    g: 0,
                    b: 0,
                    a: 255
                },
                black50: {
                    r: 0,
                    g: 0,
                    b: 0,
                    a: 127
                },
                white: {
                    r: 255,
                    g: 255,
                    b: 255,
                    a: 255
                },
                red: {
                    r: 255,
                    g: 0,
                    b: 0,
                    a: 255
                },
                green: {
                    r: 0,
                    g: 255,
                    b: 0,
                    a: 255
                },
                blue: {
                    r: 0,
                    g: 0,
                    b: 255,
                    a: 255
                },
                grey: {
                    r: 127,
                    g: 127,
                    b: 127,
                    a: 255
                }
            },

            rgba_str: {
                black: "rgba(0,0,0,1)",
                white: "rgba(255,255,255,1)",
                grey: "rgba(192,192,192,1)",
                red: "rgba(255,0,0,1)",
                green: "rgba(0,255,0,1)",
                blue: "rgba(0,0,255,1)",
                red1: "rgba(255,0,0,1)",
                red2: "rgba(255,0,0,0.5)",
                red3: "rgba(255,0,0,0.33)",
                green1: "rgba(0,255,0,1)",
                green2: "rgba(0,255,0,0.5)",
                green3: "rgba(0,255,0,0.33)",
                blue1: "rgba(0,0,255,1)",
                blue2: "rgba(0,0,255,0.5)",
                blue3: "rgba(0,0,255,0.33)"
            },

            black: {
                hex: "#000000",
                rgba: {
                    r: 0,
                    g: 0,
                    b: 0,
                    a: 1
                },
                color32: rgbaToColor32(0, 0, 0),
                rgba255: {
                    r: 0,
                    g: 0,
                    b: 0,
                    a: 255
                },
                rgba_str: "rgba(0,0,0,1)"
            },

            hex: {
                black: "#000000",
                white: "#ffffff",
                grey: "#c0c0c0",
                red: "#ff0000",
                green: "#00ff00",
                blue: "#0000ff"
            }
        },

        autoProject: function() {
            console.log("autoProject");
            q.palette.set("default", { render: false, history: false });
            autoPattern();
            q.graph.set(0, "weave", weaveTextToWeave2D8("UD_DU"));
            app.project.title = "Untitled Project";
        },

        mouse: {

            graph: "",

            _isDown: false,

            get isDown() {
                return this._isDown;
            },
            get isUp() {
                return !this._isDown;
            },
            set isDown(state) {
                this._isDown = state;
            },
            set isUp(state) {
                this._isDown = !state;
            },

            which: 0,
            col: 0,
            row: 0,
            endNum: 0,
            pickNum: 0,
            graphPos: "",
            currentx: 0,
            currenty: 0,

            isDrag: true,

            down: {
                graph: undefined,
                x: 0,
                y: 0,
                time: 0,
                which: undefined
            },

            up: {
                graph: undefined,
                x: 0,
                y: 0,
                time: 0,
                which: undefined
            },

            click: {
                x: 0,
                y: 0,
                time: 0,
                which: undefined,
                isWaiting: false
            },

            rightClick: {
                graph: undefined,
                x: 0,
                y: 0,
                time: 0,
                isWaiting: false
            },

            mouseMoveTolerance: 3,
            downUpCutOffTime: 250,
            dblClickCutOffTime: 250,
            downHoldCutOffTime: 500,

            distance: function(x0, y0, x1, y1) {
                return Math.hypot(x1 - x0, y1 - y0);
            },

            event: function(element, e, callback) {

                let _this = this;
                var type = e.type;
                var which = e.which;
                var time = getTimeStamp();
                var mx = this.x;
                var my = this.y;
                this.which = which;

                callback(type, which, mx, my);

                if (type == "mousedown") {
                    this.isDown = true;
                    this.down.element = element;
                    this.down.x = mx;
                    this.down.y = my;
                    this.down.time = time;
                    this.down.which = which;
                    $.doTimeout("mousedownholdwait", this.downHoldCutOffTime, function() {
                        var dragDistance = _this.distance(_this.x, _this.y, _this.down.x, _this.down.y);
                        var isHold = dragDistance < _this.mouseMoveTolerance;
                        if (isHold) {
                            callback("hold", which, _this.down.x, _this.down.y);
                        }
                        _this.click.isWaiting = false;
                    });

                } else if (type == "mouseup") {
                    $.doTimeout("mousedownholdwait");
                    this.isDown = false;
                    var isDblClick = false;
                    var downUpDistance = this.distance(this.x, this.y, this.down.x, this.down.y);
                    var downUpTimeDiff = getTimeStamp() - this.down.time;
                    var isClick = downUpTimeDiff < this.downUpCutOffTime && downUpDistance < this.mouseMoveTolerance && this.down.which == which;
                    if (isClick) {
                        this.click.isWaiting = true;
                        $.doTimeout("clickwait", this.dblClickCutOffTime, function() {
                            callback("click", which, _this.down.x, _this.down.y);
                            _this.click.isWaiting = false;
                        });
                        if (this.click.time) {
                            var clickTimeDiff = getTimeStamp() - this.click.time;
                            var clickDistance = this.distance(this.x, this.y, this.click.x, this.click.y);
                            isDblClick = clickTimeDiff < this.dblClickCutOffTime && clickDistance < this.mouseMoveTolerance && this.click.which == which;
                            this.click.time = isDblClick ? 0 : getTimeStamp();
                        } else {
                            this.click.time = getTimeStamp();
                        }
                        this.click.x = this.down.x;
                        this.click.y = this.down.y;
                        this.click.which = this.down.which;
                    } else {
                        this.click.time = 0;
                    }
                    if (isDblClick) {
                        $.doTimeout("clickwait");
                        this.click.isWaiting = false;
                        callback("dblclick", which, this.click.x, this.click.y);
                    }
                }

            },

            handleClickWaiting: function() {
                if (app.mouse.click.isWaiting) {
                    var moveAfterClickX = Math.abs(app.mouse.x - app.mouse.click.x);
                    var moveAfterClickY = Math.abs(app.mouse.y - app.mouse.click.y);
                    if (moveAfterClickX > app.mouse.mouseMoveTolerance || moveAfterClickY > app.mouse.mouseMoveTolerance) {
                        $.doTimeout("clickwait", false);
                    }
                }
            },

            set: function(graph, col, row, down = false, which = 0) {
                this.graph = graph;
                this.col = col;
                this.row = row;
                this.end = loopNumber(col - 1, q.graph[graph + "2D8"].length) + 1;
                this.pick = loopNumber(row - 1, q.graph[graph + "2D8"][0].length) + 1;
                this.isDown = down;
                this.which = which;
                this.graphPos = graph + "-" + col + "-" + row;
                if (which == 3) {
                    this.rightClick.graph = graph;
                    this.rightClick.col = col;
                    this.rightClick.row = row;
                }
            },

            reset: function() {
                this.graph = "";
                this.col = 0;
                this.row = 0;
                this.end = 0;
                this.pick = 0;
                this.isDown = false;
            }

        },

        localStorage_artwork: "wve_artworks",
        localStorage_weave: "wve_weaves",
        localStorage_state: "wve_states",
        localStorage_config: "wve_configs",

        saveFile: function(content, filename) {
            if (window.requestFileSystem || window.webkitRequestFileSystem) {
                var file = new File([content], filename, {
                    type: "text/plain;charset=utf-8"
                });
                saveAs(file);
            } else {
                console.log("No requestFileSystem!");
                var link = document.createElement("a");
                link.href = URL.createObjectURL(content);
                link.download = filename;
                link.click();
                //showModalWindow("Downlaod Project", "project-code-save-modal");
                //$("#project-code-save-textarea").val(JSON.stringify(app.state.obj()););
            }
        },

        // app.history:
        history: {

            recording: true,
            statei: -1,
            states: [],
            storage: undefined,

            setup: function() {
                app.history.statei = 0;
                app.history.storage = {};
                app.history.states = [];
                let state = {};
                _.each(app.state.recordItems, function(param) {
                    state[param] = 0;
                    app.history.storage[param] = [];
                    app.history.storage[param][0] = app.state.params[param];
                });
                app.history.states[0] = state;
                app.history.updateButtons();
                app.state.save(true);
                app.config.save();
            },

            on: function() {
                app.history.recording = true;
                app.history.updateButtons();
            },

            off: function() {
                app.history.recording = false;
            },

            record: function(instanceId, ...paramsToRecord) {

                if (!app.history.recording) return;

                // console.error(["history.record", instanceId]);

                let h = app.history;
                let s = app.state;

                let noHistoryParams = _.intersection(paramsToRecord, s.noHistoryItems);
                let historyParams = _.intersection(paramsToRecord, s.historyItems);

                let state = JSON.parse(JSON.stringify(h.states[h.statei]));

                // Add history step only if paramsToRecord includes any history param
                if (historyParams.length) {
                    // Slicing states upto current index
                    h.states = h.states.slice(0, h.statei + 1);
                    // Slicing state storage arrays upto current state param index
                    s.historyItems.forEach(function(param) {
                        h.storage[param] = h.storage[param].slice(0, state[param] + 1);
                    });
                    h.statei++;
                    // Push State Updated Value to Storage and Update State Referance
                    historyParams.forEach(function(param) {
                        state[param] = h.storage[param].length;
                        h.storage[param].push(s.params[param]);
                    });
                    h.states.push(state);
                    h.updateButtons();
                }

                if (noHistoryParams.length) {
                    noHistoryParams.forEach(function(param) {
                        h.storage[param][0] = s.params[param];
                    });
                }

                let doSaveWeave = paramsToRecord.includes("weave");
                app.state.save(doSaveWeave);
                app.config.save(7);
            },

            updateButtons: function() {
                let t = app.views.graph.toolbar;
                let u = "toolbar-graph-edit-undo";
                let r = "toolbar-graph-edit-redo";
                if (this.hasUndo()) { t.enableItem(u); } else { t.disableItem(u); }
                if (this.hasRedo()) { t.enableItem(r); } else { t.disableItem(r); }
            },

            hasUndo: function() {
                return app.history.statei > 0;
            },

            hasRedo: function() {
                return app.history.statei < (app.history.states.length - 1);
            },

            doStep: function(step) {
                app.history.off();
                let curStatei = app.history.statei;
                let newStatei = curStatei + step;
                let curState = app.history.states[curStatei];
                let newState = app.history.states[newStatei];
                let doSaveWeave = curState.weave !== newState.weave;
                app.state.set("app.history.do." + step, app.state.compileDifference(curStatei, newStatei));
                app.history.statei = newStatei;
                app.history.on();
                app.state.save(doSaveWeave);
            },

            redo: function() {
                if (this.hasRedo()) this.doStep(1);
            },

            undo: function() {
                if (this.hasUndo()) this.doStep(-1);
            },

        },

        state: {

            params: {
                get time() {
                    return Date.now();
                },
                get version() {
                    return app.version;
                },
                get title() {
                    return app.project.title;
                },
                get notes() {
                    return app.project.notes;
                },
                get author() {
                    return app.project.author;
                },
                get email() {
                    return app.project.email;
                },
                get palette() {
                    return q.palette.chipsArray;
                },
                get yarns() {
                    return q.graph.userYarns;
                },
                get weaves() {
                    return q.graph.userWeaves;
                },
                get warp() {
                    return compress1D(q.pattern.warp);
                },
                get weft() {
                    return compress1D(q.pattern.weft);
                },
                get ends() {
                    return q.graph.weave2D8.length;
                },
                get picks() {
                    return q.graph.weave2D8[0].length;
                },
                get weave() {
                    return (q.graph.liftingMode == "weave") ? gzip2D8(q.graph.weave2D8) : false;
                },
                get threading() {
                    return (q.graph.liftingMode == "weave") ? false : gzip2D8(q.graph.threading2D8);
                },
                get treadling() {
                    return (q.graph.liftingMode == "treadling") ? gzip2D8(q.graph.lifting2D8) : false;
                },
                get liftplan() {
                    return (q.graph.liftingMode == "liftplan") ? gzip2D8(q.graph.lifting2D8) : false;
                },
                get tieup() {
                    return (q.graph.liftingMode == "weave") ? false : gzip2D8(q.graph.tieup2D8);
                },
                get treadles() {
                    return (q.graph.liftingMode == "weave") ? false : q.graph.tieup2D8.length;
                },
                get shafts() {
                    return (q.graph.liftingMode == "weave") ? false : q.graph.tieup2D8[0].length;
                }
            },

            get keys() { return Object.keys(this.params); },
            weaveItems: ["weave"],
            graphItems: ["weave", "threading", "treadling", "tieup"],
            noHistoryItems: ["title", "notes", "weaves", "yarns"],
            noRecordItems: ["time", "version", "author", "email", "ends", "picks", "shafts", "treadles"],
            get historyItems() { return _.without(this.recordItems, ...this.noHistoryItems); },
            get recordItems() { return _.without(this.keys, ...this.noRecordItems); },
            get wifItems() { return _.without(this.keys, "weaves", "yarns"); },
            get stateItems() { return _.without(this.recordItems, "weave"); },

            compile: function(type) {
                let params = type ? this[type + "Items"] : this.keys;
                if (!params) return;
                let state = {};
                for (const param of params) state[param] = app.state.params[param];
                return state;
            },

            // Compile States Difference between two states to minimise change over delay
            compileDifference(oldStatei, newStatei) {
                let h = app.history;
                let s = app.state;
                let oldState = h.states[oldStatei];
                let newState = h.states[newStatei];
                let state = {};
                for (let param of s.historyItems) {
                    if (oldState[param] !== newState[param]) {
                        state[param] = h.storage[param][h.states[newStatei][param]];
                    }
                }
                return state;
            },

            // app.state.set:
            set: function(instanceId = 0, state = false, importOptions = false) {

                //console.error(["app.state.set", instanceId]);
                app.history.off();

                if (state?.title !== undefined && typeof state.title === 'string') app.project.title = state.title;
                if (state?.notes !== undefined && typeof state.title === 'string') app.project.notes = state.notes;

                var weaveData = gop(state, "weave", false);
                var ends = gop(state, "ends", false);
                var picks = gop(state, "picks", false);

                var threadingData = gop(state, "threading", false);
                var treadlingData = gop(state, "treadling", false);
                var liftplanData = gop(state, "liftplan", false);
                var tieupData = gop(state, "tieup", false);

                var treadles = gop(state, "treadles", false);
                var shafts = gop(state, "shafts", false);

                var importThreading = threadingData && !importOptions || gop(importOptions, "threading", false);
                var importTreadling = treadlingData && !importOptions || gop(importOptions, "treadling", false);
                var importLiftplan = liftplanData && !importOptions || gop(importOptions, "liftplan", false);
                var importTieup = !importLiftplan && tieupData && !importOptions || gop(importOptions, "tieup", false);

                var mode = weaveData ? "weave" : treadlingData ? "treadling" : liftplanData ? "liftplan" : false;
                if (!mode && importThreading) mode = "treadling";
                setLiftingMode(mode);

                if (mode == "weave") {
                    q.graph.set(1, "weave", ungzip2D8(weaveData), {
                        render: false
                    });

                } else {

                    var setWeaveFromParts = false;

                    if (importThreading) {
                        q.graph.set(3, "threading", ungzip2D8(threadingData), {
                            propagate: false
                        });
                        setWeaveFromParts = true;
                    }

                    if (importTreadling) {
                        q.graph.set(4, "lifting", ungzip2D8(treadlingData), {
                            propagate: false
                        });
                        setWeaveFromParts = true;

                    } else if (importLiftplan) {
                        q.graph.set(4, "lifting", ungzip2D8(liftplanData), {
                            propagate: false
                        });
                        q.graph.setStraightTieup();
                        setWeaveFromParts = true;
                    }

                    if (importTieup) {
                        q.graph.set(5, "tieup", ungzip2D8(tieupData), {
                            propagate: false
                        });
                        setWeaveFromParts = true;
                    }

                    if (setWeaveFromParts) q.graph.setWeaveFromParts();

                }

                var importPalette = !importOptions || gop(importOptions, "palette", false);
                var palette = gop(state, "palette", false);

                var importWarp = !importOptions || gop(importOptions, "warp", false);
                var warp = gop(state, "warp", false);

                var importWeft = !importOptions || gop(importOptions, "weft", false);
                var weft = gop(state, "weft", false);

                var importArtwork = !importOptions || gop(importOptions, "artwork", false);
                var artwork = gop(state, "artwork", false);

                if (importPalette && palette) {
                    q.palette.set(palette, { render: false, history: false });
                }

                if (importWarp && warp) {
                    q.pattern.set(237, "warp", decompress1D(warp), false);
                }

                if (importWeft && weft) {
                    q.pattern.set(238, "weft", decompress1D(weft), false);
                }

                let importWeaveLibrary = !importOptions || gop(importOptions, "weaves", false);
                let mergeWeaveLibrary = !importOptions || gop(importOptions, "mergeWeaves", true);
                let weaveLibrary = gop(state, "weaves", false);
                if (importWeaveLibrary && weaveLibrary) {
                    if (!mergeWeaveLibrary) app.wins.weaves.clearUserItems();
                    for (let id in weaveLibrary) {
                        let item = weaveLibrary[id];
                        let title = item.title;
                        let weave2D8 = ungzip2D8(item.weave);
                        app.wins.weaves.addItem("user", title, weave2D8, false);
                        XWin.render("onAddItem", "weaves", "user");
                    }
                }

                let importYarnLibrary = !importOptions || gop(importOptions, "yarns", false);
                let mergeYarnLibrary = !importOptions || gop(importOptions, "mergeYarns", true);
                let yarnLibrary = gop(state, "yarns", false);
                if (importYarnLibrary && yarnLibrary) {
                    if (!mergeYarnLibrary) app.wins.yarns.clearUserItems();
                    for (let id in yarnLibrary) {
                        let item = yarnLibrary[id];
                        app.wins.yarns.addItem("user", item, false);
                        XWin.render("onAddItem", "yarns", "user");
                    }
                }

                app.history.on();

                q.graph.updateStatusbar();
                q.pattern.updateStatusbar();

                q.graph.needsUpdate(60);
                q.pattern.needsUpdate(5);

            },

            validate: function(state) {
                let isValid = isJSON(state);
                return isValid;
            },

            save: function(doSaveWeave = true) {
                // console.error("app.state.save");
                let currentState = JSON.stringify(app.state.compile("state"));
                store.session(app.localStorage_state, currentState);
                localStorage[app.localStorage_state] = currentState;

                if (doSaveWeave) {
                    var curretnWeave = JSON.stringify(app.state.compile("weave"));
                    store.session(app.localStorage_weave, curretnWeave);
                    localStorage[app.localStorage_weave] = curretnWeave;

                }
            },

            // Local Restore
            restore: function(data) {

                // console.error("app.state.localResotre");

                var stateCode = gop(data, "state", false);
                var weaveCode = gop(data, "weave", false);
                var artworkCode = gop(data, "artwork", false);

                if (!stateCode) stateCode = store.session(app.localStorage_state);
                if (!weaveCode) weaveCode = store.session(app.localStorage_weave);
                if (!artworkCode) artworkCode = store.session(app.localStorage_artwork);

                if (!stateCode) stateCode = localStorage[app.localStorage_state];
                if (!weaveCode) weaveCode = localStorage[app.localStorage_weave];
                if (!artworkCode) artworkCode = localStorage[app.localStorage_artwork];

                if (artworkCode && isJSON(artworkCode)) {
                    let awc = JSON.parse(artworkCode);
                    let artwork = gop(awc, "artwork", false);
                    let palette = gop(awc, "palette", false);
                    if (artwork) q.artwork.artwork2D8 = ungzip2D8(artwork);
                    if (palette) q.artwork.palette = JSON.parse(palette);
                }

                if (stateCode && isJSON(stateCode)) {

                    let stateObj = JSON.parse(stateCode);
                    if (weaveCode && isJSON(weaveCode)) {
                        let weaveObj = JSON.parse(weaveCode);
                        if (weaveObj.weave) stateObj.weave = weaveObj.weave;
                        if (weaveObj.ends) stateObj.ends = weaveObj.ends;
                        if (weaveObj.picks) stateObj.picks = weaveObj.picks;
                    }
                    app.state.set("restore.state", stateObj);

                    // app.history.record("onRestoreLocalData", ...app.state.historyItems);
                    return true;
                }

                return false;

            }

        },

        config: {

            recording: true,

            data: {
                graph: ["pointPlusGrid", "crosshair", "showGrid", "drawStyle", "tieupBoxW", "tieupBoxH"],
                artwork: ["crosshair", "showGrid"]
            },

            on: function() {
                this.recording = true;
            },

            off: function() {
                this.recording = false;
            },

            // Register config param to record. app.config.register("artwork", "showGrid");
            // All XForm instances are automatically registering params to record
            register: function(parent, param) {
                if (!isSet(parent) || !parent || !isSet(param) || !param) return;
                if (this.data[parent] == undefined) this.data[parent] = [];
                if (!this.data[parent].includes(param)) this.data[parent].push(param);
            },

            save: function(instanceId) {
                if (!this.recording) return;
                let configs = {};
                for (let parent in this.data) {
                    configs[parent] = {};
                    for (let param of this.data[parent]) {
                        configs[parent][param] = q[parent].params[param];
                    }
                }
                // console.error("app.config.save");
                // console.log(configs);
                let currentConfigs = JSON.stringify(configs);
                store.session(app.localStorage_config, currentConfigs);
                localStorage[app.localStorage_config] = currentConfigs;
            },

            restore: function(options) {

                // console.error("app.config.restore");
                this.recording = false;
                let _this = this;
                var configs = gop(options, "configs", false);

                if (!configs) configs = store.session(app.localStorage_config);
                if (!configs) configs = localStorage[app.localStorage_config];

                if (configs) {
                    configs = JSON.parse(configs);
                    for (let parent in this.data) {
                        if (this.data[parent].length) {
                            this.data[parent].forEach(function(param) {
                                _this.apply(configs, parent, param);
                            });
                        }
                    }
                }
                this.recording = true;
            },

            // Apply config value to parent.param
            apply: function(configs, parent, param) {
                q[parent].params[param] = gop(configs[parent], param, q[parent].params[param]);
            }

        }

    };

    var globalPalette = {

        chipH: 48,
        colors: {},
        codes: [...
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
        ],
        selected: "a",
        marked: false,
        rightClicked: false,
        gradientL: 64,

        defaultChipProps: {
            code: 0,
            name: "",
            yarnId: "system_0",
            hex: "#000000",
        },

        createLayout: function() {

            var container = $("#palette-container");

            $("<div>", {
                    id: "palette-chip-0",
                    "class": "palette-chip",
                    "data-ref": "0"
                })
                .append("<span>&times;</span>")
                .append("<div class='color-box transparent'></div>")
                .appendTo(container);

            q.palette.setChip({
                code: 0,
                hex: "#000000"
            });

            q.palette.codes.forEach(function(code, i) {
                $("<div>", {
                        id: "palette-chip-" + code,
                        "class": "palette-chip palette-chip-active",
                        "data-ref": code
                    })
                    .append("<span>" + code + "</span>")
                    .append("<div class='color-box'></div>")
                    .append("<div class='arrow-warp'></div>")
                    .append("<div class='arrow-weft'></div>")
                    .appendTo(container);
                q.palette.setChip({
                    code: code
                });
            });

            $(document).on("mousedown", ".palette-chip", function(evt) {
                var code = $(this).attr("id").slice(-1);
                if (evt.which === 1) {
                    q.palette.selectChip(code);
                } else if (evt.which === 3) {
                    q.palette.rightClicked = code;
                }
            });

            $(document).on("mouseenter", ".palette-chip", function(evt) {
                let code = $(this).attr("id").slice(-1);
                if (code.in(0, "0")) {
                    MouseTip.hide();
                } else {
                    let color = q.palette.colors[code];
                    MouseTip.show();
                    if (q.palette.marked && q.palette.markedFor == "change") {
                        MouseTip.text(0, "Change " + q.palette.marked + " to " + code);
                    } else if (q.palette.marked && q.palette.markedFor == "swap") {
                        MouseTip.text(0, "Swap " + q.palette.marked + " and " + code);
                    } else {
                        MouseTip.text(0, color.name);
                        let yarnName = q.graph.yarns?.[color.yarnId] !== undefined ? q.graph.yarns[color.yarnId].name : "Default";
                        MouseTip.text(1, yarnName);
                    }
                }
            });

            $(document).on("mouseleave", ".palette-chip", function(evt) {
                MouseTip.hide();
            });

        },

        get chipObjectKeys() {
            return Object.keys(this.defaultChipProps);
        },

        getGradient: function(code, gradientW) {
            var i, n;
            var res = new Uint32Array(gradientW);
            if (gradientW == 1) {
                res[0] = q.palette.colors[code].color32;
            } else if (gradientW == 2) {
                res[0] = q.palette.colors[code].light32;
                res[1] = q.palette.colors[code].dark32;
            } else {
                var src = this.colors[code].lineargradient;
                for (n = 0; n < gradientW; n++) {
                    i = mapNumberToRange(n, 0, gradientW - 1, 0, src.length - 1, true, true);
                    res[n] = src[i];
                }
            }
            return res;
        },

        // q.palette.set:
        set: function(data = "default", params = {}) {

            let _this = this;

            let render = gop(params, "render", true);
            let history = gop(params, "history", true);

            if (data == "default") {

                var def = "000000ffffffdd4132ff6f61d36c5a8e5b52fa9a854a342ebc693cf967149f9c99ada498b59663837a69e9bd5cd2c29d8c6900f0ead6be9800f7e8a1b9a023f3e7796162478c944048543982c77506680d08a68c174a4587d1d301aed60a60975772849bc0e000539c2a4b7c2a293eb3a2d2ae71b4d271b485677bba88a7d4a8c3730238c62168b52d58f27a9dce5b78cf2243661f2b9b1b3072262c";
                var arr = def.match(/.{1,6}/g);
                this.codes.forEach(function(c, i) {
                    q.palette.setChip({
                        reset: true,
                        code: c,
                        hex: arr[i]
                    });
                });

            } else if (data == "random") {
                var randomColorArray = ["#000000", "#FFFFFF"].concat(randomColorHexArray(50, params));
                this.codes.forEach(function(c, i) {
                    q.palette.setChip({
                        code: c,
                        hex: randomColorArray[i]
                    });
                });

            } else {

                this.clear();
                data.forEach(function(chipObject) {
                    q.palette.setChip(chipObject);
                });

            }

            if (render) {
                q.pattern.needsUpdate(6);
                q.graph.needsUpdate(8, "weave");
            }

            if (history) {
                app.history.record("palette", "palette");
            }

        },

        clear: function() {
            this.codes.forEach(function(c, i) {
                q.palette.setChip({
                    code: c,
                    hex: "#000000"
                });
            });
        },

        // Palette
        render: function() {
            let _this = this;
            this.codes.forEach(function(code, i) {
                let color_hex = _this.colors[code].hex;
                $("#palette-chip-" + code + " .color-box").css("background-image", "none").css("background-color", color_hex);
            });
            this.updateChipArrows();
            this.selectChip(this.selected);
            this.markChip(this.marked, this.markedFor);
        },

        updateChipArrows: function() {
            var warpColors = q.pattern.warp.filter(Boolean).unique();
            var weftColors = q.pattern.weft.filter(Boolean).unique();
            $(".palette-chip").find(".arrow-warp, .arrow-weft").hide();
            warpColors.forEach(function(code) {
                let a = $("#palette-chip-" + code).find(".arrow-warp").show();
            });
            weftColors.forEach(function(code) {
                let a = $("#palette-chip-" + code).find(".arrow-weft").show();
            });
        },

        selectChip: function(code) {

            var codeA, codeB, newPattern;

            if (this.marked && !code.in(0, "0")) {

                app.history.off();
                codeA = code;
                codeB = this.marked;
                let changeWarp = !gp.lockWarp;
                let changeWeft = !gp.lockWeft;

                if (changeWarp) {
                    let newPattern = q.pattern.warp.slice();
                    if (this.markedFor == "change") {
                        newPattern = newPattern.replaceAll(codeB, codeA);
                    } else if (this.markedFor == "swap") {
                        newPattern = newPattern.replaceAll(codeA, "FLAG").replaceAll(codeB, codeA).replaceAll("FLAG", codeB);
                    }
                    q.pattern.set(19, "warp", newPattern, false);
                }

                if (changeWeft) {
                    let newPattern = q.pattern.weft.slice();
                    if (this.markedFor == "change") {
                        newPattern = newPattern.replaceAll(codeB, codeA);
                    } else if (this.markedFor == "swap") {
                        newPattern = newPattern.replaceAll(codeA, "FLAG").replaceAll(codeB, codeA).replaceAll("FLAG", codeB);
                    }
                    q.pattern.set(19, "weft", newPattern, false);
                }

                app.history.on();
                app.history.record("swapPalette", "warp", "weft");
                q.graph.needsUpdate(60);
                q.pattern.needsUpdate(5);

            }

            this.clearSelection();
            this.clearMarker();
            $("#palette-chip-" + code).addClass("highlight-chip");
            this.selected = code;

        },

        markChip: function(code, markedFor) {
            this.clearMarker();
            if (code) {
                this.selectChip(code);
                $("#palette-chip-" + code).addClass("chip-marked");
                this.marked = code;
                this.markedFor = markedFor;
            }
        },

        clearMarker: function() {
            q.palette.marked = false;
            q.palette.markedFor = false;
            $(".palette-chip").removeClass("chip-marked");
        },

        clearSelection: function() {
            q.palette.marked = false;
            $(".palette-chip").removeClass("highlight-chip");
        },

        get chipsArray() {
            let _this = this;
            var chips = [];
            this.codes.forEach(function(code) {
                chips.push(_this.getChipObject(code));
            });
            return chips;
        },

        getChipObject: function(code) {
            let _this = this;
            var chipObject = {};
            this.chipObjectKeys.forEach(function(prop) {
                chipObject[prop] = _this.colors[code][prop];
            });
            return chipObject;
        },

        hexString: function() {
            var arr = [];
            this.codes.forEach(function(c) {
                arr.push(q.palette.colors[c].hex);
            });
            return arr.join("").replace(/#/g, "");
        },

        getChipProp: function(chipParams, prop) {
            var defaultProp = gop(q.palette.defaultChipProps, prop, false);
            var currentProp = gop(q.palette.colors[chipParams.code], prop, defaultProp);
            return gop(chipParams, prop, currentProp);
        },

        setChip: function(params) {

            let _this = this;

            if (params == undefined || params.code == undefined) return;

            var chip = {};

            var resetChip = gop(params, "reset", false);

            if (_this.colors[params.code] == undefined || resetChip) {
                _this.colors[params.code] = {};
            }

            // check and optimization is required
            _this.chipObjectKeys.forEach(function(prop) {
                chip[prop] = _this.getChipProp(params, prop, false);
                _this.colors[chip.code][prop] = chip[prop];
            });

            var name = chip.name == "" ? "Color " + chip.code : chip.name;
            _this.colors[chip.code].name = name;

            var color = tinycolor(chip.hex);
            chip.hex = color.toHexString();

            var brightness = mapNumberToRange(color.getBrightness(), 0, 255, 0, 1, false, true);

            var dark, darker, dark32, darker32;
            var light, lighter, light32, lighter32;
            var visibleL, visibleHex;
            var c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10;

            var color32 = hex_rgba32(chip.hex);
            var rgba = hexToRgba1(chip.hex);
            var rgba255 = hexToRgba255(chip.hex);
            var hsl = rgbToHsl(rgba);

            var tubeGradient = [];

            if (chip.code) {

                visibleL = mapNumberToRange(hsl.l, 0, 100, 5, 95, false);
                visibleHex = hslToHex(hsl.h, hsl.s, visibleL);

                var betterHexL = mapNumberToRange(hsl.l, 0, 100, 10, 97.5, false);
                var betterHex = hslToHex(hsl.h, hsl.s, betterHexL);

                light = hexHsvChange(betterHex, 0, 0, 0.05);
                lighter = hexHsvChange(betterHex, 0, 0, 0.20);
                dark = hexHsvChange(betterHex, 0, 0, -0.25);
                darker = hexHsvChange(betterHex, 0, 0, -0.50);

                var contrast = 0.5;
                var lightness = 0.1;

                // version 0
                // var lightnessShift = [-0.5, 0, 0.2, 0.25, 0.20, 0.15, 0, -0.15, -0.25, -0.40, -0.50];

                // version 1
                // var lightnessShift = [-0.4, -0.09, 0.23, 0.30, 0.27, 0.16, 0, -0.18, -0.36, -0.56, -0.70];

                // version 2
                var lightnessShift = [-0.56, -0.13, 0.32, 0.42, 0.39, 0.22, 0, -0.25, -0.52, -0.79, -1];

                lightnessShift.forEach(function(v, i) {
                    tubeGradient.push(i / (lightnessShift.length - 1));
                    tubeGradient.push(hexHsvChange(betterHex, 0, 0, (v + lightness) * contrast));
                });

            } else {

                light = lighter = dark = darker = visibleHex = chip.hex;

            }

            var rgba_str = color.toRgbString();
            var rgba255_visible = hexToRgba255(visibleHex);
            var rgba_visible = hexToRgba1(visibleHex);

            var lineargradient = gradient32Arr(this.gradientL, ...tubeGradient);
            var gradientData = getGradientData(this.gradientL, 0, light, 0.50, chip.hex, 1, dark);

            this.colors[chip.code].hex = chip.hex;
            this.colors[chip.code].color32 = color32;

            this.colors[chip.code].light = light;
            this.colors[chip.code].lighter = lighter;
            this.colors[chip.code].dark = dark;
            this.colors[chip.code].darker = darker;

            this.colors[chip.code].light32 = hex_rgba32(light);
            this.colors[chip.code].lighter32 = hex_rgba32(lighter);
            this.colors[chip.code].dark32 = hex_rgba32(dark);
            this.colors[chip.code].darker32 = hex_rgba32(darker);

            this.colors[chip.code].rgba = rgba;
            this.colors[chip.code].rgba_visible = rgba_visible;
            this.colors[chip.code].rgba255 = rgba255;
            this.colors[chip.code].rgba255_visible = rgba255_visible;
            this.colors[chip.code].rgba_str = rgba_str;
            this.colors[chip.code].lineargradient = lineargradient;
            this.colors[chip.code].gradientData = gradientData;
            this.colors[chip.code].hsl = hsl;
            this.colors[chip.code].brightness = brightness;

            let yarnId = this.colors[chip.code].yarnId;
            if (q.graph.yarns[yarnId] !== undefined) {
                this.colors[chip.code].system = q.graph.yarns[yarnId].number_system;
                this.colors[chip.code].yarn = q.graph.yarns[yarnId].name;
            }


            if (chip.code) {
                $("#palette-chip-" + chip.code + " .color-box").css("background-image", "none").css("background-color", chip.hex);
            }

        },

        showYarnPopup: function(code) {
            this.selectChip(code);
            var element = $("#palette-chip-" + code);
            var x = element.offset().left;
            var y = element.offset().top;
            var w = element.width();
            var h = element.height();
            XForm.forms.graphColorProps.popup.show(x, y, w, h);
        },

        hideYarnPopup: function() {
            XForm.forms.graphColorProps.popup.hide();
        }

    };

    var globalGraph = {

        _tool: "pointer",
        get tool() {
            return this._tool;
        },
        set tool(value) {
            setToolbarTwoStateButtonGroup("graph", "graphTools", value);
            if (this._tool !== value) {
                this._tool = value;
                Selection.cancel();
                app.mouse.reset();
                graphDraw.reset();
                setCursor("default");
            }
        },

        floats: new Floats(),

        download: function() {
            Pdf.draft({
                origin: app.origin,
                tieup: q.graph.get("tieup"),
                threading: q.graph.get("threading"),
                lifting: q.graph.get("lifting"),
                weave: q.graph.get("weave"),
                warp: q.pattern.warp,
                weft: q.pattern.weft,
                palette: q.palette.colors,
                drawStyle: gp.drawStyle,
                liftingMode: q.graph.liftingMode,
            });
        },

        scrollTowards: function(direction, amount = 1) {

            direction = direction.split("");

            var scrollX = this.scroll.x;
            var scrollY = this.scroll.y;

            if (direction.includes("l")) {
                scrollX += amount;
            } else if (direction.includes("r")) {
                scrollX -= amount;
            }

            if (direction.includes("b")) {
                scrollY += amount;
            } else if (direction.includes("t")) {
                scrollY -= amount;
            }

            this.scroll.setPos({
                x: scrollX,
                y: scrollY
            });

        },

        weaveBuffer: false,
        weave2D8: false,
        tieup2D8: false,
        lifting2D8: false,
        threading2D8: false,

        threading1D: false,
        treadling1D: false,

        ends: 0,
        picks: 0,
        shafts: 0,

        liftingMode: "weave", // "weave", "liftplan", "treadling", "compound",

        get colorRepeat() {
            return {
                warp: [q.graph.ends, q.pattern.warp.length].lcm(),
                weft: [q.graph.picks, q.pattern.weft.length].lcm()
            };
        },

        weaves: {},
        get userWeaves() {
            let weaveLibraryObj = {};
            let i = 0;
            for (let id in this.weaves) {
                let item = this.weaves[id];
                if (item.tab == "user") {
                    weaveLibraryObj[i++] = {
                        title: item.title,
                        weave: gzip2D8(item.weave2D8)
                    };
                }
            }
            return weaveLibraryObj;
        },

        yarns: {},
        get userYarns() {
            let yarnLibraryObj = {};
            let i = 0;
            for (let id in this.yarns) {
                let item = Object.assign({}, this.yarns[id]);
                if (item.tab == "user") {
                    ["id", "tab", "info", "edit", "delete", "duplicate", "edit_button_class"].forEach(function(prop) {
                        delete item[prop];
                    });
                    yarnLibraryObj[i++] = item;
                }
            }
            return yarnLibraryObj;
        },

        // Graph
        params: {

            _pointPlusGrid: 4,
            get pointPlusGrid() {
                return this._pointPlusGrid;
            },
            set pointPlusGrid(value) {
                this.setPointPlusGrid(value, this.showGrid);
            },
            pointW: 3,
            pointH: 3,

            gridThickness: 1,
            _showGrid: true,
            get showGrid() {
                return this._showGrid;
            },
            set showGrid(state) {
                this.setPointPlusGrid(this.pointPlusGrid, state);
            },

            _crosshair: true,
            get crosshair() {
                return this._crosshair;
            },
            set crosshair(state) {
                this._crosshair = state;
                Selection.get("weave").showCrosshair = state;
                Selection.get("threading").showCrosshair = state;
                Selection.get("lifting").showCrosshair = state;
                Selection.get("tieup").showCrosshair = state;
                Selection.get("warp").showCrosshair = state;
                Selection.get("weft").showCrosshair = state;
                app.views.graph.toolbar.setItemState("toolbar-graph-crosshair", state);
                if (state) {
                    app.views.graph.toolbar.setItemImage("toolbar-graph-crosshair", "crosshair_on.svg");
                } else {
                    app.views.graph.toolbar.setItemImage("toolbar-graph-crosshair", "crosshair_off.svg");
                }
                app.config.save(15);
            },

            minPointPlusGrid: Math.max(1, Math.floor(q.pixelRatio)),
            maxPointPlusGrid: Math.floor(64 * q.pixelRatio),

            showGridMinPointPlusGrid: 3,
            gridThicknessDefault: 1,
            showGridPossible: true,

            seamlessWeave: true,
            seamlessThreading: false,
            seamlessLifting: false,
            seamlessWarp: false,
            seamlessWeft: false,

            tieupBoxW: 96,
            tieupBoxH: 96,

            setTieupBoxSize: function(w, h) {
                if (!w) w = this.tieupBoxW;
                if (!h) h = this.tieupBoxH;
                var ppg = this.pointPlusGrid;
                var new_tieupW = limitNumber(w, app.ui.minTieupS, app.ui.maxTieupS);
                var new_tieupH = limitNumber(h, app.ui.minTieupS, app.ui.maxTieupS);
                new_tieupW = Math.ceil(new_tieupW / ppg) * ppg;
                new_tieupH = Math.ceil(new_tieupH / ppg) * ppg;
                if (new_tieupW !== gp.tieupBoxW || new_tieupH !== gp.tieupBoxH) {
                    gp.tieupBoxW = Math.ceil(new_tieupW / ppg) * ppg;
                    gp.tieupBoxH = Math.ceil(new_tieupH / ppg) * ppg;
                    app.views.graph.update("onTieupResizerButton");
                    app.config.save();
                }
            },

            _drawStyle: "yarn", // "graph", "color", "yarn"
            get drawStyle() {
                return this._drawStyle;
            },
            set drawStyle(value) {
                this._drawStyle = value;
                app.views.graph.toolbar.setListOptionSelected("toolbar-graph-draw-style", "toolbar-graph-draw-style-" + value);
                app.config.save();
                q.graph.needsUpdate(122, "weave");
            },

            setPointPlusGrid: function(pointPlusGrid, showGrid, zoomAt = false) {

                // console.log("setPointPlusGrid");

                var currentPointPlusGrid = gp.pointPlusGrid;
                pointPlusGrid = limitNumber(pointPlusGrid, gp.minPointPlusGrid, gp.maxPointPlusGrid);
                if (pointPlusGrid >= gp.maxPointPlusGrid) {
                    app.views.graph.toolbar.disableItem("toolbar-graph-zoom-in");
                } else {
                    app.views.graph.toolbar.enableItem("toolbar-graph-zoom-in");
                }
                if (pointPlusGrid <= gp.minPointPlusGrid) {
                    app.views.graph.toolbar.disableItem("toolbar-graph-zoom-out");
                    app.views.graph.toolbar.disableItem("toolbar-graph-zoom-reset");
                } else {
                    app.views.graph.toolbar.enableItem("toolbar-graph-zoom-out");
                    app.views.graph.toolbar.enableItem("toolbar-graph-zoom-reset");
                }
                gp.showGridPossible = pointPlusGrid >= gp.showGridMinPointPlusGrid;
                var gridThickness = showGrid && gp.showGridPossible ? gp.gridThicknessDefault : 0;
                var pointW = pointPlusGrid - gridThickness;
                var pointH = pointPlusGrid - gridThickness;

                app.views.graph.toolbar.setItemState("toolbar-graph-grid", showGrid);

                if (showGrid) {
                    app.views.graph.toolbar.setItemImage("toolbar-graph-grid", "grid_on.svg");
                } else {
                    app.views.graph.toolbar.setItemImage("toolbar-graph-grid", "grid_off.svg");
                }

                gp.pointW = pointW;
                gp.pointH = pointW;
                gp.gridThickness = gridThickness;
                gp._showGrid = showGrid;
                gp._pointPlusGrid = pointPlusGrid;

                if (!app.views.graph.created) return;

                q.graph.scroll.set({
                    horizontal: {
                        point: pointPlusGrid,
                        content: q.limits.maxWeaveSize * pointPlusGrid
                    },
                    vertical: {
                        point: pointPlusGrid,
                        content: q.limits.maxWeaveSize * pointPlusGrid
                    }
                });

                q.tieup.scroll.set({
                    horizontal: {
                        point: pointPlusGrid,
                        content: q.limits.maxShafts * pointPlusGrid
                    },
                    vertical: {
                        point: pointPlusGrid,
                        content: q.limits.maxShafts * pointPlusGrid
                    }
                });

                var zoomRatio = gp.pointPlusGrid / currentPointPlusGrid;
                let newGraphScroll = {
                    x: Math.round(q.graph.scroll.x * zoomRatio),
                    y: Math.round(q.graph.scroll.y * zoomRatio)
                };
                let newTieupScroll = {
                    x: Math.round(q.tieup.scroll.x * zoomRatio),
                    y: Math.round(q.tieup.scroll.y * zoomRatio)
                };
                if (zoomAt) {
                    newGraphScroll.x = -Math.round((zoomAt.x - q.graph.scroll.x) * zoomRatio - zoomAt.x);
                    newGraphScroll.y = -Math.round((zoomAt.y - q.graph.scroll.y) * zoomRatio - zoomAt.y);
                }

                q.graph.scroll.setPos(newGraphScroll);
                q.tieup.scroll.setPos(newTieupScroll);

                Selection.setPointSize(pointPlusGrid, pointPlusGrid);
                Selection.setGridThickness(gp.gridThickness);
                Selection.get("warp").setPointSize(pointPlusGrid, app.ui.patternSpan);
                Selection.get("weft").setPointSize(app.ui.patternSpan, pointPlusGrid);

                app.config.save(15);

                q.graph.needsUpdate("onSetPointPlusGrid");
                q.pattern.needsUpdate("onSetPointPlusGrid");

            },

            graphShift: [
                ["select", false, "shiftTarget", [
                    ["weave", "Weave"],
                    ["threading", "Threading"],
                    ["lifting", "Lifting"],
                    ["tieup", "Tieup"]
                ], {
                    col: "1/1"
                }],
            ],

            autoPattern: [
                ["number", "Pattern Size", "autoPatternSize", 120, {
                    min: 1,
                    max: 16384
                }],
                ["number", "Pattern Colors", "autoPatternColors", 3, {
                    min: 1,
                    max: 52
                }],
                ["select", "Type", "autoPatternType", [
                    ["balanced", "Balanced"],
                    ["unbalanced", "Unbalanced"],
                    ["warpstripes", "Warp Stripes"],
                    ["weftstripes", "Weft Stripes"],
                    ["warponly", "Warp Only"],
                    ["weftonly", "Weft Only"],
                    ["random", "Random"]
                ], {
                    col: "2/3"
                }],
                ["select", "Style", "autoPatternStyle", [
                    ["tartan", "Tartan"],
                    ["madras", "Madras"],
                    ["wales", "Prince of Wales"],
                    ["gunclub", "Gun Club"],
                    ["gingham", "Gingham"],
                    ["sequential", "Sequential"],
                    ["golden", "Golden Ratio"],
                    ["garbage", "Garbage"],
                    ["random", "Random"]
                ], {
                    col: "2/3"
                }],
                ["check", "Even Pattern", "autoPatternEven", 1],
                ["check", "Lock Colors", "autoPatternLockColors", 0],
                ["text", false, "autoPatternLockedColors", 1, {
                    col: "1/1",
                    hide: true
                }],
                ["control", "play"]
            ],

            autoWeave: [
                ["header", "Specifications"],
                ["check", "Square Weave", "autoWeaveSquare", 1],
                ["number", "Weave Width", "autoWeaveWidth", 120, {
                    min: 2,
                    max: 16384,
                    col: "1/4"
                }],
                ["number", "Weave Height", "autoWeaveHeight", 120, {
                    min: 2,
                    max: 16384,
                    col: "1/4",
                    hide: true
                }],
                ["number", "Shafts", "autoWeaveShafts", 8, {
                    min: 2,
                    max: 256,
                    col: "1/4"
                }],
                ["header", "Design"],
                ["check", "Warp prominency", "autoWeaveShowWarpProminentSide", 0],
                ["number", "Min Threading Rigidity", "autoWeaveMinThreadingRigidity", 3, {
                    min: 0,
                    max: 256,
                    col: "1/4"
                }],
                ["number", "Max Threading Rigidity", "autoWeaveMaxThreadingRigidity", 3, {
                    min: 0,
                    max: 256,
                    col: "1/4"
                }],
                ["check", "Threading Step Rigidity", "autoWeaveThreadingStepRigidity", 0],
                ["number", "Min Treadling Rigidity", "autoWeaveMinTreadlingRigidity", 3, {
                    min: 0,
                    max: 256,
                    col: "1/4"
                }],
                ["number", "Treadling Rigidity", "autoWeaveMaxTreadlingRigidity", 3, {
                    min: 0,
                    max: 256,
                    col: "1/4"
                }],
                ["check", "Treadling Step Rigidity", "autoWeaveTreadlingStepRigidity", 0],
                ["check", "Mirror Threading", "autoWeaveMirrorThreading", 1],
                ["check", "Mirror Treadling", "autoWeaveMirrorTreadling", 1],
                ["header", "Limits"],
                ["number", "Max Warp Float", "autoWeaveMaxWarpFloat", 12, {
                    min: 0,
                    max: 256,
                    col: "1/4"
                }],
                ["number", "Min Warp Bump%", "autoWeaveMinWarpBump", 5, { min: 0, max: 50, col: "1/4" }],
                ["number", "Min Weft Bump%", "autoWeaveMinWeftBump", 5, { min: 0, max: 50, col: "1/4" }],

                ["number", "Max Weft Float", "autoWeaveMaxWeftFloat", 12, {
                    min: 0,
                    max: 256,
                    col: "1/4"
                }],
                ["number", "Min Tabby%", "autoWeaveMinTabby", 20, {
                    min: 0,
                    max: 100,
                    col: "1/4"
                }],
                ["header", "Generate Component"],
                ["check", "Threading", "autoWeaveGenerateThreading", 1],
                ["check", "Treadling", "autoWeaveGenerateTreadling", 1],
                ["check", "Tieup", "autoWeaveGenerateTieup", 1],
                ["check", "Perpetual Search", "autoWeavePerpetualSearch", 1],
                ["check", "Auto Save", "autoWeaveAutoSave", 0],
                ["control", "play"]
            ],

            newYarn: [
                ["text", "Name", "newYarnName", "New Yarn", { col: "1/1" }],
                ["number", "Yarn Number", "newYarnNumber", 20, { min: 0.01, max: 10000, precision: 2 }],
                ["select", "Number System", "newYarnNumberSystem", [
                    ["nec", "Nec"],
                    ["tex", "Tex"],
                    ["denier", "Denier"]
                ]],
                ["number", "Luster", "newYarnLuster", 25, { min: 0, max: 100 }],
                ["number", "Shadow", "newYarnShadow", 25, { min: 0, max: 100 }],
                ["select", "Profile", "newYarnProfile", [
                    ["circular", "Circular"],
                    ["elliptical", "Elliptical"],
                    ["lenticular", "Lenticular"],
                    ["rectangular", "Rectangular"]
                ], { col: "3/5" }],
                ["select", "Structure", "newYarnStructure", [
                    ["mono", "Monofilament"],
                    ["spun", "Spun"]
                ], { col: "3/5" }],
                ["number", "Aspect Ratio", "newYarnAspect", 1, { min: 1, max: 10, step: 0.1, precision: 2 }],
                ["check", "Imperfections", "newYarnImperfections", 0, { rowcss: "xcheckbox-header" }],
                ["number", "Thins/km", "newYarnThins", 10, { min: 0, max: 1000, col: "1/3", hide: true }],
                ["number", "Thicks/km", "newYarnThicks", 40, { min: 0, max: 1000, col: "1/3", hide: true }],
                ["number", "Neps/km", "newYarnNeps", 80, { min: 0, max: 1000, col: "1/3", hide: true }],
                ["number", "Number Variation", "newYarnNumberVariation", 0, { min: 0, max: 100, col: "1/3", hide: true }],
                ["number", "Uneveness", "newYarnUneveness", 0, { min: 0, max: 100, col: "1/3", hide: true }],
                ["check", "Slub Pattern", "newYarnSlub", 0, { rowcss: "xcheckbox-header" }],
                ["number", "Min Length (cm)", "newYarnMinSlubLen", 10, { min: 0, max: 100, col: "1/3", precision: 1, hide: true }],
                ["number", "Max Length (cm)", "newYarnMaxSlubLen", 10, { min: 0, max: 100, col: "1/3", precision: 1, hide: true }],
                ["number", "Min Pause (cm)", "newYarnMinSlubPause", 10, { min: 0, max: 100, col: "1/3", hide: true }],
                ["number", "Max Pause (cm)", "newYarnMaxSlubPause", 10, { min: 0, max: 100, col: "1/3", hide: true }],
                ["number", "Min Thickness", "newYarnMinSlubThickness", 10, { min: 1, max: 10, step: 0.1, precision: 2, col: "1/3", hide: true }],
                ["number", "Max Thickness", "newYarnMaxSlubThickness", 10, { min: 1, max: 10, step: 0.1, precision: 2, col: "1/3", hide: true }],
                ["control", "plus"]
            ],

            editYarn: [
                ["text", "Name", "editYarnName", "New Yarn", { col: "1/1" }],
                ["number", "Yarn Number", "editYarnNumber", 20, { min: 0.01, max: 10000, precision: 2 }],
                ["select", "Number System", "editYarnNumberSystem", [
                    ["nec", "Nec"],
                    ["tex", "Tex"],
                    ["denier", "Denier"]
                ]],
                ["number", "Luster", "editYarnLuster", 25, { min: 0, max: 100 }],
                ["number", "Shadow", "editYarnShadow", 25, { min: 0, max: 100 }],
                ["select", "Profile", "editYarnProfile", [
                    ["circular", "Circular"],
                    ["elliptical", "Elliptical"],
                    ["lenticular", "Lenticular"],
                    ["rectangular", "Rectangular"]
                ], { col: "3/5" }],
                ["select", "Structure", "editYarnStructure", [
                    ["mono", "Monofilament"],
                    ["spun", "Spun"]
                ], { col: "3/5" }],
                ["number", "Aspect Ratio", "editYarnAspect", 1, { min: 1, max: 10, step: 0.1, precision: 2 }],
                ["check", "Imperfections", "editYarnImperfections", 0, { rowcss: "xcheckbox-header" }],
                ["number", "Thins/km", "editYarnThins", 10, { min: 0, max: 1000, col: "1/3" }],
                ["number", "Thicks/km", "editYarnThicks", 40, { min: 0, max: 1000, col: "1/3" }],
                ["number", "Neps/km", "editYarnNeps", 80, { min: 0, max: 1000, col: "1/3" }],
                ["number", "Number Variation", "editYarnNumberVariation", 0, { min: 0, max: 100, col: "1/3" }],
                ["number", "Uneveness", "editYarnUneveness", 0, { min: 0, max: 100, col: "1/3" }],
                ["check", "Slub Pattern", "editYarnSlub", 0, { rowcss: "xcheckbox-header" }],
                ["number", "Min Length (cm)", "editYarnMinSlubLen", 10, { min: 0, max: 100, col: "1/3", precision: 1 }],
                ["number", "Max Length (cm)", "editYarnMaxSlubLen", 10, { min: 0, max: 100, col: "1/3", precision: 1 }],
                ["number", "Min Pause (cm)", "editYarnMinSlubPause", 10, { min: 0, max: 100, col: "1/3" }],
                ["number", "Max Pause (cm)", "editYarnMaxSlubPause", 10, { min: 0, max: 100, col: "1/3" }],
                ["number", "Min Thickness", "editYarnMinSlubThickness", 10, { min: 1, max: 10, step: 0.1, precision: 2, col: "1/3" }],
                ["number", "Max Thickness", "editYarnMaxSlubThickness", 10, { min: 1, max: 10, step: 0.1, precision: 2, col: "1/3" }],
                ["control", "save"]
            ],

            harnessCastout: [
                ["text", "Pattern", "castoutPattern", 1, {
                    col: "1/1"
                }],
                ["control", "play"]
            ],

            stripeResize: [
                ["text", "Stripe No.", "stripeResizeStripeNo", 1, {
                    col: "1/3",
                    disable: true
                }],
                ["number", "New Size", "stripeResizeNewSize", 1, {
                    col: "1/3",
                    min: 1,
                    max: 16384
                }],
                ["check", "Preview", "stripeResizePreview", 1],
                ["control", "play"]
            ],

            weaveTools: [
                ["button", "Shuffle Ends", "weaveToolsShuffleEnds", "play", { col: "1/3" }]
            ],

            weaveRepeat: [
                ["select", "Type", "weaveRepeatType", [
                    ["block", "Block"],
                    ["drop", "Drop"],
                    ["brick", "Brick"]
                ], {
                    col: "2/3"
                }],
                ["number", "X Repeats", "weaveRepeatXRepeats", 1, {
                    min: 1,
                    max: 16384
                }],
                ["number", "Y Repeats", "weaveRepeatYRepeats", 1, {
                    min: 1,
                    max: 16384
                }],
                ["number", "Shift", "weaveRepeatShift", 0, {
                    min: -16384,
                    max: 16384
                }],
                ["control", "play"]
            ],

            autoColorway: [
                ["select", "Type", "autoColorwayType", [
                    ["warpandweft", "Warp & Weft"],
                    ["warponly", "Warp Only"],
                    ["weftonly", "Weft Only"]
                ], {
                    col: "2/3"
                }],
                ["check", "Share Colors", "autoColorwayShareColors", 1],
                ["check", "Link Colors", "autoColorwayLinkColors", 1],
                ["check", "Lock Colors", "autoColorwayLockColors", 0],
                ["text", false, "autoColorwayLockedColors", 1, {
                    col: "1/1",
                    hide: true
                }],
                ["control", "play"]
            ],

            viewSettings: [
                ["header", "Seamless"],
                ["check", "Weave", "seamlessWeave", 0],
                ["check", "Warp", "seamlessWarp", 0],
                ["check", "Weft", "seamlessWeft", 0],
                ["check", "Threading", "seamlessThreading", 0],
                ["check", "Lifting", "seamlessLifting", 0],
                ["header", "View"],
                ["check", "Minor Grid", "showMinorGrid", 1],
                ["check", "Major Grid", "showMajorGrid", 1],
                ["number", "Major Grid Every", "majorGridEvery", 8, {
                    min: 2,
                    max: 300
                }],
                ["separator"],
                ["select", "Repeat Opacity", "repeatOpacity", [
                    [100, "100%"],
                    [75, "75%"],
                    [50, "50%"],
                    [25, "25%"]
                ]],
                ["select", "Repeat Calc", "repeatCalc", [
                    ["lcm", "LCM"],
                    ["weave", "Weave"],
                    ["pattern", "Pattern"]
                ], {
                    col: "1/2"
                }],
            ],

            locks: [
                ["check", "Threading", "lockThreading", 1],
                ["check", "Treadling", "lockTreadling", 1],
                ["check", "Warp Pattern", "lockWarp", 0],
                ["check", "Weft Pattern", "lockWeft", 0],

                ["header", "Manual Locks"],

                ["check", "Warp = Weft", "lockWarpToWeft", 0],
                ["check", "Shaft = Treadle", "lockShaftsToTreadles", 0],

                ["header", "Configurations"],

                ["check", "Auto Trim", "autoTrim", 0]

            ],

            autoPalette: [
                ["check", "Uniform Distribution", "autoPaletteCoverSpectrum", 1],
                ["range", "Hue From", "autoPaletteMinHue", 0, { min: 0, max: 360, step: 1 }],
                ["range", "Hue To", "autoPaletteMaxHue", 360, { min: 0, max: 360, step: 1 }],
                ["range", "Min Saturation %", "autoPaletteMinSaturation", 25, { min: 0, max: 100, step: 1 }],
                ["range", "Max Saturation %", "autoPaletteMaxSaturation", 75, { min: 0, max: 100, step: 1 }],
                ["range", "Min Luminosity %", "autoPaletteMinLuminosity", 25, { min: 0, max: 100, step: 1 }],
                ["range", "Max Luminosity %", "autoPaletteMaxLuminosity", 75, { min: 0, max: 100, step: 1 }],
                ["control", "play"]
            ],

            colorProps: [
                ["dynamicHeader", false, "colorPropsTitle", "Color _"],
                ["text", "Name", "colorPropsName", "Yarn", { col: "2/3" }],
                ["color", "Color", "colorPropsHex", "#FFFFFF", { col: "2/3" }],
                ["select", "Yarn/Material", "colorPropsYarnId", [
                    ["system_0", "Default"]
                ], { col: "1/1" }],
                ["control", "save"]
            ],

            scaleWeave: [

                ["number", "Ends", "scaleWeaveEnds", 2, {
                    min: 2,
                    max: q.limits.maxWeaveSize
                }],
                ["number", "Picks", "scaleWeavePicks", 2, {
                    min: 2,
                    max: q.limits.maxWeaveSize
                }],
                ["control", "play"]

            ],

            generateTwill: [

                ["text", "End Pattern", "generateTwillEndPattern", "3U1D", {
                    col: "1/1"
                }],
                ["check", "Generate Random", "generateTwillGenerateRandom", 0],
                ["number", "Twill Height", "generateTwillHeight", 4, {
                    col: "1/3",
                    min: 3,
                    max: q.limits.maxWeaveSize
                }],
                ["number", "End Risers", "generateTwillEndRisers", 1, {
                    col: "1/3",
                    min: 1,
                    max: 100
                }],
                ["number", "Warp Projection %", "generateTwillWarpProjection", 50, {
                    col: "1/3",
                    min: 1,
                    max: 100
                }],
                ["select", "Move Number", "generateTwillMoveNumber", [
                    ["1", "1"]
                ], {
                    col: "1/3"
                }],
                ["select", "Direction", "generateTwillDirection", [
                    ["s", "S"],
                    ["z", "Z"]
                ], {
                    col: "1/3"
                }],
                ["control", "play"]

            ],

            testForm: [

                ["header", "Header", "testHeader"],
                ["dynamicHeader", false, "testDH", "testDHValue", {
                    col: "3/5"
                }],
                ["color", "Color", "testColor", "#FF0000", {
                    col: "2/3"
                }],
                ["number", "Number", "testNumber", 12, {
                    col: "1/3",
                    min: 1,
                    max: 100
                }],
                ["section", "Section", "testSection"],
                ["select", "Select", "testSelect", [
                    ["s", "S"],
                    ["z", "Z"]
                ], {
                    col: "1/3"
                }],
                ["text", "Text", "testText", "3U1D", {
                    col: "1/2"
                }],
                ["check", "Check", "testCheck", 0],
                ["range", "Range", "testRange", 4500, {
                    min: 2700,
                    max: 7500,
                    step: 100
                }],
                ["control", "save", "play"]

            ]

        },

        // q.graph.setInterface
        setInterface: function(instanceId = 0) {

            // console.error("q.graph.setInterface");

            if (app.views.active !== "graph") return false;

            var interBoxSpace = app.ui.shadow + app.ui.space + app.ui.shadow;
            var wallBoxSpace = app.ui.shadow;

            var paletteBoxW = app.frame.width - app.ui.shadow * 2;
            var paletteBoxH = q.palette.chipH;

            var weftBoxL = Scrollbars.size + app.ui.shadow;
            var liftingBoxL = weftBoxL + app.ui.patternSpan + interBoxSpace;
            var weaveBoxL = liftingBoxL + gp.tieupBoxW + interBoxSpace;

            var warpBoxB = Scrollbars.size + wallBoxSpace;
            var threadingBoxB = warpBoxB + app.ui.patternSpan + interBoxSpace;
            var weaveBoxB = threadingBoxB + gp.tieupBoxH + interBoxSpace;

            var weaveBoxW = app.frame.width - (Scrollbars.size + app.ui.patternSpan + gp.tieupBoxW + interBoxSpace * 2 + wallBoxSpace * 2);
            var weaveBoxH = app.frame.height - (Scrollbars.size + app.ui.patternSpan + gp.tieupBoxH + paletteBoxH + interBoxSpace * 3 + wallBoxSpace * 2 - app.ui.space);

            Debug.item("weaveBoxW", weaveBoxW);
            Debug.item("weaveBoxH", weaveBoxH);

            let nonWeaveElements = $("#graph-resizer-button, #threading-container, #lifting-container, #tieup-container");

            let tieupBoxW, tieupBoxH;

            if (q.graph.liftingMode == "weave") {

                nonWeaveElements.hide();

                weaveBoxL = liftingBoxL;
                weaveBoxB = threadingBoxB;
                weaveBoxW = weaveBoxW + gp.tieupBoxW + interBoxSpace;
                weaveBoxH = weaveBoxH + gp.tieupBoxH + interBoxSpace;

            } else {

                nonWeaveElements.show();

                tieupBoxW = gp.tieupBoxW;
                tieupBoxH = gp.tieupBoxH;
                var tieupContext = q.ctx(61, "tieup-container", "tieupDisplay", tieupBoxW, tieupBoxH, true, true);
                tieupContext.clearRect(0, 0, tieupBoxW, tieupBoxH);

                var tieupLayerContext = q.ctx(61, "tieup-container", "tieupLayerDisplay", tieupBoxW, tieupBoxH);
                tieupLayerContext.clearRect(0, 0, tieupBoxW, tieupBoxH);
                Selection.get("tieup").ctx = tieupLayerContext;

                var liftingBoxW = gp.tieupBoxW;
                var liftingBoxH = weaveBoxH;
                var liftingContext = q.ctx(61, "lifting-container", "liftingDisplay", liftingBoxW, liftingBoxH, true, true);
                liftingContext.clearRect(0, 0, liftingBoxW, liftingBoxH);

                var liftingLayerContext = q.ctx(61, "lifting-container", "liftingLayerDisplay", liftingBoxW, liftingBoxH);
                liftingLayerContext.clearRect(0, 0, liftingBoxW, liftingBoxH);
                Selection.get("lifting").ctx = liftingLayerContext;

                var threadingBoxW = weaveBoxW;
                var threadingBoxH = gp.tieupBoxH;
                var threadingContext = q.ctx(61, "threading-container", "threadingDisplay", threadingBoxW, threadingBoxH, true, true);
                threadingContext.clearRect(0, 0, threadingBoxW, threadingBoxH);

                var threadingLayerContext = q.ctx(61, "threading-container", "threadingLayerDisplay", threadingBoxW, threadingBoxH);
                threadingLayerContext.clearRect(0, 0, threadingBoxW, threadingBoxH);
                Selection.get("threading").ctx = threadingLayerContext;

                setContainerSizePosition("lifting-container", liftingBoxW, liftingBoxH, weaveBoxB, liftingBoxL);
                setContainerSizePosition("threading-container", threadingBoxW, threadingBoxH, threadingBoxB, weaveBoxL);
                setContainerSizePosition("tieup-container", tieupBoxW, tieupBoxH, threadingBoxB, liftingBoxL);

                $("#graph-resizer-button").css({
                    "width": 5,
                    "height": 5,
                    "bottom": weaveBoxB - 5,
                    "left": weaveBoxL - 5,
                });

            }

            var weaveContext = q.ctx(61, "weave-container", "weaveDisplay", weaveBoxW, weaveBoxH, true, true);
            var weaveLayerContext = q.ctx(61, "weave-container", "weaveLayerDisplay", weaveBoxW, weaveBoxH);
            weaveLayerContext.clearRect(0, 0, weaveBoxW, weaveBoxH);
            Selection.get("weave").ctx = weaveLayerContext;

            var warpContext = q.ctx(61, "warp-container", "warpDisplay", weaveBoxW, app.ui.patternSpan, true, true);
            var warpLayerContext = q.ctx(61, "warp-container", "warpLayerDisplay", weaveBoxW, app.ui.patternSpan);
            warpLayerContext.clearRect(0, 0, app.ui.patternSpan, weaveBoxH);
            Selection.get("warp").ctx = warpLayerContext;

            var weftContext = q.ctx(61, "weft-container", "weftDisplay", app.ui.patternSpan, weaveBoxH, true, true);
            var weftLayerContext = q.ctx(61, "weft-container", "weftLayerDisplay", app.ui.patternSpan, weaveBoxH);
            weftLayerContext.clearRect(0, 0, app.ui.patternSpan, weaveBoxH);
            Selection.get("weft").ctx = weftLayerContext;

            Selection.setPointSize(gp.pointPlusGrid, gp.pointPlusGrid);
            Selection.setGridThickness(gp.gridThickness);

            Selection.get("warp").setPointSize(gp.pointPlusGrid, app.ui.patternSpan);
            Selection.get("weft").setPointSize(app.ui.patternSpan, gp.pointPlusGrid);

            setContainerSizePosition("weave-container", weaveBoxW, weaveBoxH, weaveBoxB, weaveBoxL);
            setContainerSizePosition("warp-container", weaveBoxW, app.ui.patternSpan, warpBoxB, weaveBoxL);
            setContainerSizePosition("weft-container", app.ui.patternSpan, weaveBoxH, weaveBoxB, weftBoxL);

            $("#palette-container").css({
                "width": paletteBoxW,
                "height": paletteBoxH,
                "left": app.ui.shadow,
                "top": app.ui.shadow,
                "box-shadow": "0px 0px 0px " + app.ui.shadow + "px " + "#FFF",
                "-webkit-box-shadow": "0px 0px 0px " + app.ui.shadow + "px " + "#FFF",
                "-moz-box-shadow": "0px 0px 0px " + app.ui.shadow + "px " + "#FFF",
            });

            var chipWidth = Math.floor(paletteBoxW / 53);
            var chipRemainder = paletteBoxW - chipWidth * 53;
            $('.palette-chip').css({
                "width": chipWidth
            });
            $('.palette-chip:lt(' + chipRemainder + ')').css({
                "width": chipWidth + 1
            });

            q.position.update("weave");
            q.position.update("warp");
            q.position.update("weft");
            q.position.update("tieup");
            q.position.update("lifting");
            q.position.update("threading");
            globalStatusbar.set("graphIntersection", "-", "-");

            if (q.graph.scroll == undefined) {
                q.graph.scroll = new Scrollbars({
                    id: "weave",
                    parent: "graph-frame",
                    view: "weave-container",
                    onScroll: function(xy, pos) {
                        let isWeaveMode = q.graph.liftingMode == "weave";
                        if (xy !== "y") {
                            q.pattern.needsUpdate(9.1, "warp", false);
                            if (!isWeaveMode) q.graph.needsUpdate(38, "threading", false);
                        }
                        if (xy !== "x") {
                            q.pattern.needsUpdate(9.2, "weft", false);
                            if (!isWeaveMode) q.graph.needsUpdate(38, "lifting", false);
                        }
                        q.graph.needsUpdate(36, "weave", false);
                    }
                });
            }

            q.graph.scroll.set({
                horizontal: {
                    point: gp.pointPlusGrid,
                    content: q.limits.maxWeaveSize * gp.pointPlusGrid,
                    width: weaveBoxW + app.ui.shadow * 2 - 2,
                    left: weaveBoxL - app.ui.shadow + 1,
                    bottom: 0
                },
                vertical: {
                    point: gp.pointPlusGrid,
                    content: q.limits.maxWeaveSize * gp.pointPlusGrid,
                    height: weaveBoxH + app.ui.shadow * 2 - 2,
                    left: 0,
                    bottom: weaveBoxB - app.ui.shadow + 1
                }
            });

            if (q.tieup.scroll == undefined) {
                q.tieup.scroll = new Scrollbars({
                    id: "tieup",
                    parent: "graph-frame",
                    view: "tieup-container",
                    onScroll: function(xy, pos) {
                        if (xy !== "y") {
                            q.graph.needsUpdate(38, "lifting", false);
                        }
                        if (xy !== "x") {
                            q.graph.needsUpdate(38, "threading", false);
                        }
                        q.graph.needsUpdate(36, "tieup", false);
                    }
                });
            }

            if (q.graph.liftingMode == "weave") {
                q.tieup.scroll.hide();
            } else {
                q.tieup.scroll.show();
            }

            q.tieup.scroll.set({
                horizontal: {
                    point: gp.pointPlusGrid,
                    content: q.limits.maxShafts * gp.pointPlusGrid,
                    width: tieupBoxW + app.ui.shadow * 2 - 2,
                    left: liftingBoxL - app.ui.shadow + 1,
                    bottom: 0,
                },
                vertical: {
                    point: gp.pointPlusGrid,
                    content: q.limits.maxShafts * gp.pointPlusGrid,
                    height: tieupBoxH + app.ui.shadow * 2 - 2,
                    left: 0,
                    bottom: threadingBoxB - app.ui.shadow + 1,
                }
            });

            let menu = app.views.graph.menu;

            if (q.graph.liftingMode == "weave") {
                menu.hideItem("graph-liftplan");
                menu.hideItem("graph-treadling");
                menu.hideItem("graph-threading");
                menu.hideItem("graph-tieup");

            } else if (q.graph.liftingMode == "treadling") {
                menu.hideItem("graph-liftplan");
                menu.showItem("graph-treadling");
                menu.showItem("graph-threading");
                menu.showItem("graph-tieup");

            } else if (q.graph.liftingMode == "liftplan") {
                menu.showItem("graph-liftplan");
                menu.hideItem("graph-treadling");
                menu.showItem("graph-threading");
                menu.hideItem("graph-tieup");
            }

        },

        new: function(ends = q.limits.minWeaveSize, picks = q.limits.minWeaveSize) {
            q.graph.set(0, "weave", newArray2D8(20, ends, picks));
        },

        updateStatusbar: function() {

            Status.weaveSize(q.graph.ends, q.graph.picks);
            Status.shafts();
            Status.treadles();
            Status.projection();
            Status.tabby();
            Status.weaveBump();

            graphPromiseWorker.postMessage({
                buffer: q.graph.weaveBuffer,
                width: q.graph.ends,
                height: q.graph.picks,
            }).then(function(response) {
                if (response) {
                    Status.shafts(response.shafts, q.limits.maxShafts);
                    Status.treadles(response.treadles, q.limits.maxShafts);
                    Status.projection(response.warpProjection, response.weftProjection);
                    Status.tabby(response.tabby);
                    Status.weaveBump(response.bump?.warp, response.bump?.weft);
                }
            }).catch(function(error) {
                console.error(error);
            });

            var wps = q.pattern.warp.length;
            var wfs = q.pattern.weft.length;
            var wpr = [wps, q.graph.ends].lcm();
            var wfr = [wfs, q.graph.picks].lcm();
            Status.repeat(wpr, wfr);

        },

        setThreading1D: function() {
            this.threading1D = threading2D8_threading1D(this.threading2D8);
        },

        setTreadling1D: function() {
            if (!this.lifting2D8) return;
            this.treadling1D = treadling2D8_treadling1D(this.lifting2D8);
        },

        width: function(graph) {
            return this[graph + "2D8"] !== undefined ? this[graph + "2D8"].length : 0;
        },

        height: function(graph) {
            return this.width(graph) && this[graph + "2D8"][0] !== undefined ? this[graph + "2D8"][0].length : 0;
        },

        // q.graph.get:
        get: function(graph = "weave", startEnd = false, startPick = false, lastEnd = false, lastPick = false) {

            var arr = this[graph + "2D8"];

            if (!isArray2D(arr)) {
                arr = newArray2D8(21, 2, 2);
            }

            var arrW = arr.length;
            var arrH = arr[0].length;

            var seamlessX = lookup(graph, ["weave", "threading"], [gp.seamlessWeave, gp.seamlessThreading]);
            var seamlessY = lookup(graph, ["weave", "lifting"], [gp.seamlessWeave, gp.seamlessLifting]);

            if (startEnd && startPick && lastEnd && lastPick) {

                var xOverflow = seamlessX ? "loop" : "extend";
                var yOverflow = seamlessY ? "loop" : "extend";

                arr = arr.copy2D8(startEnd - 1, startPick - 1, lastEnd - 1, lastPick - 1, xOverflow, yOverflow, 0);

            } else if (startEnd && startPick && !lastEnd && !lastPick) {

                var endi = seamlessX ? loopNumber(startEnd - 1, arrW) : startEnd - 1;
                var picki = seamlessY ? loopNumber(startPick - 1, arrH) : startPick - 1;

                arr = arr[endi] !== undefined && arr[endi][picki] !== undefined ? arr[endi][picki] : 0;

            }

            return arr;

        },

        weaveNeedsUpdate: true,
        threadingNeedsUpdate: true,
        liftingNeedsUpdate: true,
        tieupNeedsUpdate: true,

        needsUpdate: function(instanceId = 0, graph = false, updateNow = true) {
            if (!graph || graph === "weave") this.weaveNeedsUpdate = true;
            if (!graph || graph === "threading") this.threadingNeedsUpdate = true;
            if (!graph || graph === "lifting") this.liftingNeedsUpdate = true;
            if (!graph || graph === "tieup") this.tieupNeedsUpdate = true;
            if (updateNow) this.update();
        },

        // q.graph.update
        update: function() {

            if (app.views.active !== "graph" || !app.views.graph.created) return;

            if (this.weaveNeedsUpdate) {
                Debug.item("weave", false, "update");
                Selection.get("weave").scroll(q.graph.scroll.x, q.graph.scroll.y);
                this.render("weave", this.weave2D8, "bl", q.graph.scroll.x, q.graph.scroll.y, gp.seamlessWeave, gp.seamlessWeave, gp.drawStyle);
                this.weaveNeedsUpdate = false;
            }

            if (q.graph.liftingMode === "weave") return;

            if (this.threadingNeedsUpdate) {
                Debug.item("threading", false, "update");
                Selection.get("threading").scroll(q.graph.scroll.x, q.tieup.scroll.y);
                this.render("threading", this.threading2D8, "bl", q.graph.scroll.x, q.tieup.scroll.y, gp.seamlessThreading, false);
                this.threadingNeedsUpdate = false;
            }

            if (this.liftingNeedsUpdate) {
                Debug.item("lifting", false, "update");
                Selection.get("lifting").scroll(q.tieup.scroll.x, q.graph.scroll.y);
                this.render("lifting", this.lifting2D8, "bl", q.tieup.scroll.x, q.graph.scroll.y, false, gp.seamlessLifting);
                this.liftingNeedsUpdate = false;
            }

            if (this.tieupNeedsUpdate) {
                Debug.item("tieup", false, "update");
                Selection.get("tieup").scroll(q.tieup.scroll.x, q.tieup.scroll.y);
                let editable = q.graph.liftingMode === "liftplan" ? false : true;
                this.render("tieup", this.tieup2D8, "bl", q.tieup.scroll.x, q.tieup.scroll.y, false, false, "graph", editable);
                this.tieupNeedsUpdate = false;
            }

        },

        // q.graph.render
        render: function(graph, weave, origin = "tl", scrollX = 0, scrollY = 0, seamlessX = false, seamlessY = false, drawStyle = "graph", editable = true) {

            // console.log(["render", ctx.canvas.id]);
            // console.log(arguments);

            Debug.item("scrollX > " + graph, scrollX, "graph");
            Debug.item("scrollY > " + graph, scrollY, "graph");

            if (!weave || !weave.is2D8()) return;

            var x, y, i, newDrawX, newDrawY, pointW, pointH, state, arrX, arrY, drawX, drawY, color, gradient, code, gradientOrientation, threadi;
            var sx, sy, lx, ly;
            var xTranslated, yTranslated;
            var fabricRepeatW, fabricRepeatH;

            let id = graph + "Display";
            var ctx = q.context[id];
            if (!ctx) return;

            Debug.time("render > " + graph, "perf");

            var elW = ctx.canvas.clientWidth;
            var elH = ctx.canvas.clientHeight;

            var ctxW = ctx.canvas.width;
            var ctxH = ctx.canvas.height;

            Debug.item("ctx.canvas.clicenWidth", ctx.canvas.clientWidth, "graph");
            Debug.item("ctx.canvas.clicenHeight", ctx.canvas.clientHeight, "graph");

            Debug.item("ctx.canvas.width", ctx.canvas.width, "graph");
            Debug.item("ctx.canvas.height", ctx.canvas.hxeight, "graph");

            let pixels = q.pixels[id];
            let pixels8 = q.pixels8[id];
            let pixels32 = q.pixels32[id];
            pixels32.fill(app.colors.black.color32);

            var arrW = weave.length;
            var arrH = weave[0].length;
            var arrView = new Uint8Array(q.graph[graph + "Buffer"]);

            var ppg = gp.pointPlusGrid;
            var gridT = gp.gridThickness;

            var warpPatternL = q.pattern.warp.length;
            var weftPatternL = q.pattern.weft.length;
            var repeatCalc = gp.repeatCalc;
            if (repeatCalc == "weave" || drawStyle == "graph") {
                fabricRepeatW = arrW;
                fabricRepeatH = arrH;
            } else if (repeatCalc == "pattern") {
                fabricRepeatW = warpPatternL;
                fabricRepeatH = weftPatternL;
            } else if (repeatCalc == "lcm") {
                fabricRepeatW = [arrW, warpPatternL].lcm();
                fabricRepeatH = [arrH, weftPatternL].lcm();
            }

            var drawAreaW = seamlessX && arrW ? ctxW : Math.min(ctxW, fabricRepeatW * ppg + scrollX);
            var drawAreaH = seamlessY && arrH ? ctxH : Math.min(ctxH, fabricRepeatH * ppg + scrollY);

            // Point Indices Translated
            var ix_point = new Int16Array(ctxW);
            var iy_point = new Int16Array(ctxH);
            for (x = 0; x < ctxW; ++x) ix_point[x] = Math.floor((x - scrollX) / ppg);
            for (y = 0; y < ctxH; ++y) iy_point[y] = Math.floor((y - scrollY) / ppg);

            var backgroundVisible = drawAreaW < ctxW || drawAreaH < ctxH;

            // Draw Background Check
            if (backgroundVisible) {
                var checkLight = app.ui.check.light;
                var checkDark = app.ui.check.dark;
                for (y = 0; y < ctxH; ++y) {
                    i = (ctxH - y - 1) * ctxW;
                    for (x = 0; x < ctxW; ++x) {
                        pixels32[i + x] = (ix_point[x] + iy_point[y]) & 1 ? checkLight : checkDark;
                    }
                }
            }

            if (gp.pointW == 1 && drawStyle == "yarn") drawStyle = "color";
            if (!warpPatternL || !weftPatternL) drawStyle = "graph";

            let gridLight, gridDark, gridColor32;
            if (gridT) {
                gridLight = app.ui.grid.light;
                gridDark = app.ui.grid.dark;
                gridColor32 = drawStyle == "color" ? gridDark : app.colors.black.color32;
            }

            // Draw Grid at Back
            if (gridT && drawStyle !== "graph" && backgroundVisible) {
                let majorEvery = gp.showMajorGrid ? gp.majorGridEvery : 0;
                bufferGrid(origin, pixels8, pixels32, ctxW, ctxH, ppg, ppg, scrollX, scrollY, gp.showMinorGrid, majorEvery, majorEvery, gridLight, gridDark);
            }

            var pointOffsetX = scrollX % ppg;
            var pointOffsetY = scrollY % ppg;

            var xMaxPoints = Math.ceil((ctxW - pointOffsetX) / ppg);
            var yMaxPoints = Math.ceil((ctxH - pointOffsetY) / ppg);

            var xOffsetPoints = Math.floor(Math.abs(scrollX) / ppg);
            var yOffsetPoints = Math.floor(Math.abs(scrollY) / ppg);

            var xDrawPoints = seamlessX ? xMaxPoints : Math.min(fabricRepeatW - xOffsetPoints, xMaxPoints);
            var yDrawPoints = seamlessY ? yMaxPoints : Math.min(fabricRepeatH - yOffsetPoints, yMaxPoints);

            xDrawPoints = Math.max(0, xDrawPoints);
            yDrawPoints = Math.max(0, yDrawPoints);

            var drawStartIndexX = xOffsetPoints;
            var drawStartIndexY = yOffsetPoints;

            var drawLastIndexX = drawStartIndexX + xDrawPoints;
            var drawLastIndexY = drawStartIndexY + yDrawPoints;

            let weaveIndexTranslatedX, weaveIndexTranslatedY, patternTranslatedX32, patternTranslatedY32;

            // Weave Indices Translated to draw Area
            if (drawAreaW > 0 && drawAreaH > 0) {

                weaveIndexTranslatedX = new Int16Array(drawAreaW);
                weaveIndexTranslatedY = new Int16Array(drawAreaH);
                patternTranslatedX32 = new Uint32Array(drawAreaW);
                patternTranslatedY32 = new Uint32Array(drawAreaH);
                var patternIndex, patternCode, gradient32, gradientShadeIndex, oldPatternIndex;

                var isGridPixel;

                oldPatternIndex = -1;
                for (x = 0; x < drawAreaW; ++x) {
                    weaveIndexTranslatedX[x] = loopNumber(ix_point[x], arrW);
                    patternIndex = loopNumber(ix_point[x], warpPatternL);
                    patternCode = q.pattern.warp[patternIndex];
                    isGridPixel = loopNumber(x - pointOffsetX, ppg) >= gp.pointW;
                    if (drawStyle == "color") {
                        patternTranslatedX32[x] = isGridPixel ? gridColor32 : q.palette.colors[patternCode].color32;
                    } else if (drawStyle == "yarn") {
                        if (patternIndex !== oldPatternIndex) {
                            gradient32 = q.palette.getGradient(patternCode, gp.pointW);
                            oldPatternIndex = patternIndex;
                        }
                        gradientShadeIndex = loopNumber(x - pointOffsetX, ppg);
                        patternTranslatedX32[x] = isGridPixel ? gridColor32 : gradient32[gradientShadeIndex];
                    }
                }

                oldPatternIndex = -1;
                for (y = 0; y < drawAreaH; ++y) {
                    weaveIndexTranslatedY[y] = loopNumber(iy_point[y], ~~arrH);
                    patternIndex = loopNumber(iy_point[y], weftPatternL);
                    patternCode = q.pattern.weft[patternIndex];
                    isGridPixel = loopNumber(y - pointOffsetY, ppg) >= gp.pointW;
                    if (drawStyle == "color") {
                        patternTranslatedY32[y] = isGridPixel ? gridColor32 : q.palette.colors[patternCode].color32;
                    } else if (drawStyle == "yarn") {
                        if (patternIndex !== oldPatternIndex) {
                            gradient32 = q.palette.getGradient(patternCode, gp.pointW);
                            oldPatternIndex = patternIndex;
                        }
                        gradientShadeIndex = loopNumber(y - pointOffsetY, ppg);
                        patternTranslatedY32[y] = isGridPixel ? gridColor32 : gradient32[gp.pointW - gradientShadeIndex - 1];
                    }
                }

            }

            if (drawAreaW > 0 && drawAreaH > 0) {
                if (drawStyle.in("color", "yarn")) {
                    for (y = 0; y < drawAreaH; ++y) {
                        arrY = weaveIndexTranslatedY[y];
                        i = (ctxH - y - 1) * ctxW;
                        for (x = 0; x < drawAreaW; ++x) {
                            arrX = weaveIndexTranslatedX[x];
                            pixels32[i + x] = arrView[arrX * ~~arrH + arrY] ? patternTranslatedX32[x] : patternTranslatedY32[y];
                        }
                    }
                } else if (drawStyle == "graph" || drawStyle == "disable") {
                    let up = editable ? q.upColor32 : q.upColor32_disable;
                    let down = q.downColor32;
                    for (y = 0; y < drawAreaH; ++y) {
                        arrY = weaveIndexTranslatedY[y];
                        i = (ctxH - y - 1) * ctxW;
                        for (x = 0; x < drawAreaW; ++x) {
                            arrX = weaveIndexTranslatedX[x];
                            pixels32[i + x] = arrView[arrX * ~~arrH + arrY] ? up : down;
                        }
                    }
                }
            }

            // Draw Grid at Top
            if (gridT && drawStyle == "graph") {
                let majorEvery = gp.showMajorGrid ? gp.majorGridEvery : 0;
                bufferGrid(origin, pixels8, pixels32, ctxW, ctxH, ppg, ppg, scrollX, scrollY, gp.showMinorGrid, majorEvery, majorEvery, gridLight, gridDark);
            }

            if (gridT && drawStyle !== "graph") {

                var pointArrX = new Int16Array(xDrawPoints);
                var pointArrY = new Int16Array(yDrawPoints);
                var pointSX = new Int16Array(xDrawPoints);
                var pointSY = new Int16Array(yDrawPoints);
                for (x = 0; x < xDrawPoints; ++x) {
                    pointArrX[x] = loopNumber(x + xOffsetPoints, arrW);
                    pointSX[x] = x * ppg + pointOffsetX;
                }
                for (y = 0; y < yDrawPoints; ++y) {
                    pointArrY[y] = loopNumber(y + yOffsetPoints, arrH);
                    pointSY[y] = y * ppg + pointOffsetY;
                }
                for (y = 0; y < yDrawPoints; ++y) {
                    sy = pointSY[y];
                    for (x = 0; x < xDrawPoints; ++x) {
                        sx = pointSX[x];
                        state = arrView[pointArrX[x] * ~~arrH + pointArrY[y]];
                        if (state) {
                            bufferRect32(app.origin, pixels32, ctxW, ctxH, sx - gridT, sy, gridT, ppg, gridColor32);
                        } else {
                            bufferRect32(app.origin, pixels32, ctxW, ctxH, sx, sy - gridT, ppg, gridT, gridColor32);
                        }
                    }
                }

            }

            ctx.putImageData(pixels, 0, 0);

            Debug.timeEnd("render > " + graph, "perf");

        },

        zoom: function(amount) {
            var newPointPlusGrid = amount ? gp.pointPlusGrid + amount : 1;
            gp.pointPlusGrid = newPointPlusGrid;
        },

        zoomAt: function(pointX, pointY, amount = 1) {
            gp.setPointPlusGrid(gp.pointPlusGrid + amount, gp.showGrid, {
                x: pointX,
                y: pointY
            });
        },

        setThreading2D: function(data, colNum = 0, shaftNum = 0, render = true, renderSimulation = true) {
            var x, y, shaftState, treadleIndex;
            if (data == "" || data == "toggle" || data == "T") {
                data = this.threading2D8[colNum - 1][shaftNum - 1] == 0 ? 1 : 0;
            }
            var threadingW = this.threading2D8.length;
            var threadingH = this.threading2D8[0].length;
            if ($.isArray(data)) {
                if (colNum && rowNum) {
                    this.threading2D8 = paste2D_old(data, this.threading2D8, colNum - 1, shaftNum - 1);
                } else {
                    this.threading2D8 = newArray2D8(22, threadingW, threadingH);
                    this.threading2D8 = data;
                }
            } else if (data == 0 || data == 1) {
                this.threading2D8[colNum - 1] = [1].repeat(threadingH);
                this.threading2D8[colNum - 1][shaftNum - 1] = data;
                if (q.graph.liftingMode == "liftplan") {
                    this.setEnd(colNum, this.lifting2D8[shaftNum - 1]);
                } else if (q.graph.liftingMode == "treadling") {
                    this.setTreadling1D();
                    var liftingPicks = this.lifting2D8[0].length;
                    for (y = 0; y < liftingPicks; y++) {
                        treadleIndex = this.treadling1D[y] - 1;
                        shaftState = this.tieup2D8[treadleIndex][shaftNum - 1];
                        q.graph.weave2D8[colNum - 1][y] = shaftState;
                    }
                    q.graph.render(0, "weave");
                }
            }
            this.setThreading1D();
            if (render) {
                q.graph.needsUpdate(16, "threading");
            }
        },

        setPoint: function(graph, colNum = 0, rowNum = 0, state = true, render = true, commit = true) {

            var seamlessX = lookup(graph, ["weave", "threading", "tieup"], [gp.seamlessWeave, gp.seamlessThreading, false]);
            var seamlessY = lookup(graph, ["weave", "lifting", "tieup"], [gp.seamlessWeave, gp.seamlessLifting, false]);

            if ((colNum > 0 || seamlessX) && (rowNum > 0 || seamlessY)) {

                var arrW = this[graph + "2D8"].length;
                var arrH = this[graph + "2D8"][0].length;
                let x = colNum - 1;
                let y = rowNum - 1;
                if (seamlessX) x = loopNumber(x, arrW);
                if (seamlessY) y = loopNumber(y, arrH);

                if (commit) this[graph + "2D8"][x][y] = state;

                if (render) {

                    let id = graph + "Display";
                    var ctx = q.context[id];
                    var ctxW = ctx.canvas.clientWidth;
                    var ctxH = ctx.canvas.clientHeight;

                    var sx = (colNum - 1) * gp.pointPlusGrid + q.graph.scroll.x;
                    var sy = ctxH - rowNum * gp.pointPlusGrid - q.graph.scroll.y + gp.gridThickness;
                    var pixels = ctx.getImageData(sx, sy, gp.pointW, gp.pointW);
                    var pixels32 = new Uint32Array(pixels.data.buffer);

                    let up = app.colors.black32;
                    let down = app.colors.grey32;

                    for (let i = 0; i < pixels32.length; ++i)
                        pixels32[i] = state ? up : down;

                    ctx.putImageData(pixels, sx, sy);

                }

            }

        },

        graphCorrection: function(graph, arr) {

            var x, y;
            var w = arr.length;
            var h = arr[0].length;
            var res;

            if (graph == "threading") {
                res = newArray2D8(103, w, h, 0);
                for (x = 0; x < w; x++) {
                    y = arr[x].indexOf(1);
                    if (y >= 0) {
                        res[x][y] = 1;
                    }
                }

            } else if (graph == "treadling") {
                res = newArray2D8(103, h, w, 0);
                let nArr = arr.rotate2D8("r").flip2D8("y");
                for (x = 0; x < h; x++) {
                    y = nArr[x].indexOf(1);
                    if (y >= 0) {
                        res[x][y] = 1;
                    }
                }
                res = res.rotate2D8("l").flip2D8("x");

            } else {
                res = arr;

            }

            return res;

        },

        // q.graph.set:
        set: function(instanceId, graph, tile2D8 = false, options = {}) {

            let initGraph = graph;

            Debug.time("setTotal", "graph");
            // console.error(["q.graph.set", graph]);
            // console.log(["setGraph", ...arguments]);

            if (graph.in("treadling", "liftplan")) graph = "lifting";

            var colNum = gop(options, "col", 0);
            var rowNum = gop(options, "row", 0);
            var render = gop(options, "render", true);
            var doAutoTrim = gop(options, "trim", true);
            var propagate = gop(options, "propagate", true);

            if (!isArray2D(this[graph + "2D8"])) {
                this[graph + "2D8"] = newArray2D8(102, 2, 2);
            }

            var canvas = this[graph + "2D8"];
            var canvasW = canvas.length;
            var canvasH = canvas[0].length;

            var seamlessX = lookup(graph, ["weave", "threading"], [gp.seamlessWeave, gp.seamlessThreading]);
            var seamlessY = lookup(graph, ["weave", "lifting"], [gp.seamlessWeave, gp.seamlessLifting]);

            if (!tile2D8) {
                tile2D8 = this[graph + "2D8"];
            }

            if (isArray2D(tile2D8)) {
                tile2D8 = this.graphCorrection(initGraph, tile2D8);
            }

            var x, y, shaftIndex, treadleIndex, result;

            if (colNum && rowNum) {

                var xOverflow = seamlessX ? "loop" : "extend";
                var yOverflow = seamlessY ? "loop" : "extend";

                var endNum = xOverflow == "loop" ? loopNumber(colNum - 1, canvasW) + 1 : colNum;
                var pickNum = yOverflow == "loop" ? loopNumber(rowNum - 1, canvasH) + 1 : rowNum;

                if (tile2D8 == "toggle") {
                    tile2D8 = q.graph.get(graph, endNum, pickNum);
                }

                if (tile2D8 === 0 || tile2D8 === 1) {
                    tile2D8 = [new Uint8Array([1 - tile2D8])];
                }

                Debug.time("clone", "graph");
                result = canvas.clone2D8();
                Debug.timeEnd("clone", "graph");

                var blankPart;
                if (graph == "lifting" && q.graph.liftingMode == "treadling") {
                    blankPart = newArray2D8(23, canvasW, tile2D8[0].length, 0);
                    result = paste2D8(blankPart, result, 0, rowNum - 1, xOverflow, yOverflow, 0);
                } else if (graph == "threading") {
                    blankPart = newArray2D8(24, tile2D8.length, canvasH, 0);
                    result = paste2D8(blankPart, result, colNum - 1, 0, xOverflow, yOverflow, 0);
                }

                Debug.time("paste", "graph");
                tile2D8 = paste2D8(tile2D8, result, colNum - 1, rowNum - 1, xOverflow, yOverflow, 0);
                Debug.timeEnd("paste", "graph");

            }

            if (gp.autoTrim && doAutoTrim) {
                var trimR = !seamlessX ? "r" : "";
                var trimT = !seamlessY ? "t" : "";
                var trimSides = trimR + trimT;
                result = trimWeave2D8(2, tile2D8, trimSides);
            } else {
                result = tile2D8;
            }

            var sw = result.length;
            var sh = result[0].length;

            // keeping minimum graph size
            if (result.length < 2 || result[0].length < 2) {
                let graphBase = newArray2D8("graphBase", 2, 2);
                result = paste2D8(result, graphBase);
            }

            this[graph + "2D8"] = result;
            this[graph + "Buffer"] = array2D8ToBuffer(result);

            if (graph == "weave") {
                this.ends = sw;
                this.picks = sh;
            } else if (graph == "threading") {
                this.setThreading1D();
            } else if (graph == "lifting" && q.graph.liftingMode == "treadling") {
                this.setTreadling1D();
            }

            if (propagate) {

                Debug.time("propagate", "graph");

                if (graph == "lifting" && q.graph.liftingMode == "treadling" && gp.lockShaftsToTreadles) {
                    var newThreading = this.lifting2D8.clone2D8().rotate2D8("r").flip2D8("y");
                    q.graph.set(0, "threading", newThreading, {
                        propagate: false
                    });
                    this.setWeaveFromParts();

                } else if (graph == "threading" && q.graph.liftingMode == "treadling" && gp.lockShaftsToTreadles) {
                    var newTreadling = this.threading2D8.clone2D8().rotate2D8("l").flip2D8("x");
                    q.graph.set(0, "lifting", newTreadling, {
                        propagate: false
                    });
                    this.setWeaveFromParts();

                } else if (graph == "weave" && q.graph.liftingMode !== "weave") {
                    this.setPartsFromWeave(2);

                } else if (graph !== "weave" && q.graph.liftingMode !== "weave") {
                    this.setWeaveFromParts();

                }

                if (q.graph.liftingMode == "liftplan" && (graph == "lifting" || graph == "threading")) {
                    q.graph.setStraightTieup();
                }

                Debug.timeEnd("propagate", "graph");

            }

            if (render) {

                if (graph == "weave" && this.weave2D8 && this.weave2D8[0]) {
                    // var weaveProps = getWeaveProps(this.weave2D8);
                    // q.graph.shafts = weaveProps.inLimit ? weaveProps.shafts : q.limits.maxShafts+1;
                    // globalStatusbar.set("shafts");
                    q.graph.updateStatusbar();
                }

                q.graph.needsUpdate(17, graph);
            }

            if (propagate) {
                app.history.record("setGraph", ...app.state.graphItems);
            }

            Debug.timeEnd("setTotal", "graph");

        },

        setLifting: function(data, colNum = 0, rowNum = 0, render = true, renderSimulation = true) {
            var x, y, shaftIndex, treadleIndex;

            if (data == "" || data == "toggle" || data == "T") {
                if (this.lifting2D8[colNum - 1] !== undefined && this.lifting2D8[colNum - 1][rowNum - 1] !== undefined) {
                    data = this.lifting2D8[colNum - 1][rowNum - 1] == 1 ? 0 : 1;
                } else {
                    data = 1;
                }
            }

            data = [
                [data]
            ];

            var liftingW = this.lifting2D8.length;
            var lifting2D8 = this.lifting2D8.clone();

            if (colNum && rowNum) {
                if (q.graph.liftingMode == "treadling") {
                    var emptyWeave = newArray2D(liftingW, data[0].length, 1);
                    lifting2D8 = paste2D_old(emptyWeave, lifting2D8, 0, rowNum - 1, false, gp.seamlessLifting, 1);
                }
                lifting2D8 = paste2D_old(data, lifting2D8, colNum - 1, rowNum - 1, false, gp.seamlessLifting, 1);
            } else {
                lifting2D8 = data;
            }

            //this.lifting2D8 = trimWeave(lifting2D8);

            this.setWeaveFromParts();

            if (render) {
                q.graph.needsUpdate(18, "lifting");
            }
        },

        setWeaveFromParts: function(threading2D8 = false, lifting2D8 = false, tieup2D8 = false, render = true) {

            var x, y, shaft, treadle, tieupState;

            console.error("setWeaveFromParts");

            if (!threading2D8) threading2D8 = this.threading2D8;
            if (!lifting2D8) lifting2D8 = this.lifting2D8;
            if (!tieup2D8) tieup2D8 = this.tieup2D8;

            if (threading2D8.length < 2 || threading2D8[0].length < 2) {
                let graphBase = newArray2D8("graphBase", 2, 2);
                threading2D8 = paste2D8(threading2D8, graphBase);
            }

            if (lifting2D8.length < 2 || lifting2D8[0].length < 2) {
                let graphBase = newArray2D8("graphBase", 2, 2);
                lifting2D8 = paste2D8(lifting2D8, graphBase);
            }

            if (tieup2D8.length < 2 || tieup2D8[0].length < 2) {
                let graphBase = newArray2D8("graphBase", 2, 2);
                tieup2D8 = paste2D8(tieup2D8, graphBase);
            }

            var threadingW = threading2D8.length;
            var liftingH = lifting2D8[0].length;
            var threading1D = threading2D8_threading1D(threading2D8);
            var weave2D8 = newArray2D8(25, threadingW, liftingH);

            if (q.graph.liftingMode == "treadling" || q.graph.liftingMode == "weave") {
                var treadling1D = treadling2D8_treadling1D(lifting2D8);
                for (x = 0; x < threadingW; x++) {
                    shaft = threading1D[x];
                    for (y = 0; y < liftingH; y++) {
                        treadle = treadling1D[y];
                        if (shaft && treadle && tieup2D8[treadle - 1] !== undefined && tieup2D8[treadle - 1][shaft - 1] !== undefined) {
                            tieupState = tieup2D8[treadle - 1][shaft - 1];
                            weave2D8[x][y] = tieupState;
                        }
                    }
                }

            } else if (q.graph.liftingMode == "liftplan") {
                threading1D.forEach(function(shaftNum, i) {
                    weave2D8[i] = shaftNum && lifting2D8[shaftNum - 1] !== undefined ? lifting2D8[shaftNum - 1] : new Uint8Array(liftingH);
                });

            }

            q.graph.set(0, "weave", weave2D8, {
                render: render,
                propagate: false,
                trim: false
            });

        },

        setTieup: function(data, colNum = 0, rowNum = 0, render = true, renderSimulation = true) {
            var x, y;
            if (data == "" || data == "toggle" || data == "T") {
                data = this.tieup2D8[colNum - 1][rowNum - 1] == 1 ? 0 : 1;
            }
            var treadles = this.tieup2D8.length;
            var shafts = this.tieup2D8[0].length;
            if ($.isArray(data)) {
                if (colNum && rowNum) {
                    this.tieup2D8 = paste2D_old(data, this.tieup2D8, colNum - 1, rowNum - 1);
                } else {
                    this.tieup2D8 = newArray2D8(26, treadles, shafts);
                    this.tieup2D8 = paste2D_old(data, this.tieup2D8, 0, 0);
                }
            } else if (data == 1) {
                this.tieup2D8[colNum - 1][rowNum - 1] = 1;
            }

            var treadleIndex = colNum - 1;
            this.setThreading1D();

            for (y = 0; y < this.picks; y++) {
                if (this.lifting2D8[treadleIndex][y] == 1) {
                    for (x = 0; x < this.ends; x++) {
                        if (this.threading1D[x] == rowNum) {
                            q.graph.weave2D8[x][y] = this.tieup2D8[colNum - 1][rowNum - 1];
                        }
                    }
                }
            }

            q.graph.needsUpdate(20, "weave");

            /*
            this.weave2D8 = newArray2D8(27, this.ends, this.picks);
            for ( x = 0; x < this.tieup2D8.length; x++) {
            	for ( y = 0; y < this.tieup2D8.length; y++) {
            		if ( this.tieup2D8[x][y] == 1){
            			this.setShaft(y+1, this.lifting2D8[x]);
            		}
            	}
            }
            */

            if (render) {
                q.graph.needsUpdate(21, "tieup");
            }
        },

        setShaft: function(shaftNum, endArray, render = true) {
            for (let x = 0; x < this.ends; x++) {
                if (this.threading2D8[x][shaftNum - 1] == 1) {
                    this.setEnd(x + 1, endArray, render);
                }
            }
        },

        setEnd: function(endNum, endArray, render = true) {
            this.weave2D8[endNum - 1] = endArray;
            if (render) {
                q.graph.needsUpdate(22, "weave");
            }
        },

        convertLiftplanToTieupTreadling: function() {

            var tt = liftplanToTieupTreadling(this.lifting2D8);
            var tieup = tt[0];
            var treadling = tt[1];

            q.graph.set(42, "tieup", tieup, {
                propagate: false
            });
            q.graph.set(43, "lifting", treadling, {
                propagate: false
            });

        },

        convertTreadlingToLiftplan: function() {
            var liftplan = tieupTreadlingToLiftplan(this.tieup2D8, this.lifting2D8);
            var shafts = Math.max(this.lifting2D8.length, this.threading2D8[0].length);
            q.graph.set(43, "lifting", liftplan, {
                propagate: false
            });
            q.graph.setStraightTieup();
        },

        setStraightTieup: function() {
            let liftingW = this.lifting2D8.length;
            let threadingH = this.threading2D8[0].length;
            let maxShafts = Math.max(liftingW, threadingH);
            var tieup2D8 = newArray2D8(29, maxShafts, maxShafts);
            for (var x = 0; x < maxShafts; x++) tieup2D8[x][x] = 1;
            q.graph.set(42, "tieup", tieup2D8, {
                propagate: false
            });
        },

        setPartsFromWeave: function(instanceId, weave2D8 = false, render = false) {

            console.log(["setPartsFromWeave", instanceId]);

            if (!weave2D8) weave2D8 = this.weave2D8;
            if (!is2D8(weave2D8)) weave2D8 = newArray2D8("setPartsFromWeave", 2, 2);

            var weaveProps = getWeaveProps(weave2D8);

            if (weaveProps.inLimit) {
                q.graph.set(40, "threading", weaveProps.threading2D8, {
                    propagate: false
                });

                if (q.graph.liftingMode == "liftplan") {
                    q.graph.set(41, "lifting", weaveProps.liftplan2D8, {
                        propagate: false
                    });
                    q.graph.setStraightTieup();

                } else {
                    q.graph.set(42, "tieup", weaveProps.tieup2D8, {
                        propagate: false
                    });
                    q.graph.set(43, "lifting", weaveProps.treadling2D8, {
                        propagate: false
                    });

                }

            } else {
                setLiftingMode("weave");

            }

        },

        insertEndAt: function(endNum, renderSimulation) {
            var zeroEndArray = [1].repeat(this.picks);
            var newWeave = q.graph.weave2D8.insertAt(endNum - 1, zeroEndArray);
            q.graph.set(37, newWeave, renderSimulation);
        },

        insertPickAt: function(pickNum, renderSimulation) {
            var x;
            var newWeave = this.weave2D8.clone2D8();
            for (x = 0; x < this.ends; x++) {
                newWeave[x] = newWeave[x].insertAt(pickNum - 1, 1);
            }
            q.graph.set(38, newWeave, renderSimulation);
        },

        delete: {

            columns: function(graph, startX, lastX) {
                let newGraph = q.graph.get(graph);
                if (startX > lastX) {
                    newGraph = newGraph.slice(lastX + 1, startX);
                } else {
                    let graphWidth = q.graph[graph + "2D8"].length;
                    newGraph = newGraph.slice(0, startX).concat(newGraph.slice(lastX + 1, graphWidth));
                }
                q.graph.set("delete.columns", graph, newGraph);
            },

            rows: function(graph, startY, lastY) {
                var newGraph = q.graph.get(graph);
                let graphWidth = q.graph[graph + "2D8"].length;
                if (startY > lastY) {
                    for (let x = 0; x < graphWidth; x++) {
                        newGraph[x] = newGraph[x].slice(lastY + 1, startY);
                    }
                } else {
                    let graphHeight = q.graph[graph + "2D8"][0].length;
                    for (let x = 0; x < graphWidth; x++) {
                        newGraph[x] = newGraph[x].slice(0, startY).concat(newGraph[x].slice(lastY + 1, graphHeight));
                    }
                }
                q.graph.set("delete.rows", graph, newGraph);
            }
        }

    };

    var globalTieup = {

        gridT: 0,

        treadles: 0,
        shafts: 0,

        resizing: function() {
            if (app.tieupResizeStart && app.mouse.isDown) {
                let dx = app.mouse.x - app.mouse.down.x;
                let dy = app.mouse.down.y - app.mouse.y;
                app.views.graph.needsUpdate = true;
                gp.setTieupBoxSize(app.tieupResizeStartW + dx, app.tieupResizeStartH + dy);
                MouseTip.hide();
                return true;
            }
            return false;
        },

        scrollTowards: function(direction, amount = 1) {
            direction = direction.split("");
            var scrollX = this.scroll.x;
            var scrollY = this.scroll.y;
            if (direction.includes("l")) {
                scrollX += amount;
            } else if (direction.includes("r")) {
                scrollX -= amount;
            }
            if (direction.includes("b")) {
                scrollY += amount;
            } else if (direction.includes("t")) {
                scrollY -= amount;
            }
            this.scroll.setPos({
                x: scrollX,
                y: scrollY
            });
        },

    };

    var globalSimulation = {

        created: false,
        needsUpdate: true,

        profiles: {},

        width: {
            px: 0,
            mm: 0
        },

        height: {
            px: 0,
            mm: 0
        },

        // Simulation
        params: {

            structure: [
                ["select", "Mode", "mode", [
                    ["quick", "Quick"],
                    ["scaled", "Scaled"]
                ], {
                    col: "1/2"
                }],
                ["select", "Draw", "drawMethod", [
                    ["3d", "3D"],
                    ["flat", "Flat"]
                ], {
                    col: "1/2"
                }],
                ["color", "Background", "backgroundColor", "#000000", {
                    col: "1/2"
                }],

                ["select", "Yarns", "yarnConfig", [
                    ["biset", "Bi-Set"],
                    ["palette", "Palette"]
                ], {
                    col: "2/5",
                    hide: true
                }],

                ["select", "Warp", "warpYarnId", [ ["system_0", "Default"] ], { col: "2/3", hide: true }],
                ["select", "Weft", "weftYarnId", [ ["system_0", "Default"] ], { col: "2/3", hide: true }],

                ["number", "Warp Size", "warpSize", 2, {
                    min: 1,
                    max: 16
                }],
                ["number", "Weft Size", "weftSize", 2, {
                    min: 1,
                    max: 16
                }],
                ["number", "Warp Space", "warpSpace", 0, {
                    min: 0,
                    max: 16
                }],
                ["number", "Weft Space", "weftSpace", 0, {
                    min: 0,
                    max: 16
                }],

                ["number", "Warp Density", "warpDensity", 55, {
                    min: 10,
                    max: 300,
                    hide: true
                }],
                ["number", "Weft Density", "weftDensity", 55, {
                    min: 10,
                    max: 300,
                    hide: true
                }],
                ["button", false, "calculateScreenDPI", "Calculate Screen DPI", {
                    col: "1/1",
                    hide: true
                }],
                ["number", "Screen DPI", "screenDPI", 110, {
                    min: 72,
                    max: 480,
                    hide: true
                }],
                ["number", "Zoom", "zoom", 1, {
                    min: 1,
                    max: 100,
                    hide: true
                }],

                ["number", "Reed Filling", "reedFill", 1, {
                    min: 1,
                    max: 8,
                    hide: true
                }],
                ["number", "Denting Space", "dentingSpace", 0.2, {
                    min: 0,
                    max: 1,
                    step: 0.05,
                    precision: 2,
                    hide: true
                }],

                ["check", "Fuzzy Surface", "fuzzySurface", 1, { hide: true }],
                ["number", "Render Quality", "renderQuality", 1, {
                    min: 1,
                    max: 8,
                    hide: true
                }],

                ["control", "save", "play"]
            ],

            yarn: [
                ["check", "Yarn Imperfections", "renderYarnImperfections", 0],
                ["number", "Warp Thins", "warpThins", 10, {
                    min: 0,
                    max: 500
                }],
                ["number", "Warp Thicks", "warpThicks", 40, {
                    min: 0,
                    max: 500
                }],
                ["number", "Warp Neps", "warpNeps", 80, {
                    min: 0,
                    max: 500
                }],
                ["number", "Warp Thickness Jitter", "warpThicknessJitter", 0.01, {
                    min: 0,
                    max: 1,
                    step: 0.01,
                    precision: 2
                }],
                ["number", "Warp Node Thickness Jitter", "warpNodeThicknessJitter", 0.03, {
                    min: 0,
                    max: 1,
                    step: 0.01,
                    precision: 2
                }],
                ["number", "Weft Thins", "weftThins", 10, {
                    min: 0,
                    max: 500
                }],
                ["number", "Weft Thicks", "weftThicks", 40, {
                    min: 0,
                    max: 500
                }],
                ["number", "Weft Neps", "weftNeps", 80, {
                    min: 0,
                    max: 500
                }],
                ["number", "Weft Thickness Jitter", "weftThicknessJitter", 0.01, {
                    min: 0,
                    max: 1,
                    step: 0.01,
                    precision: 2
                }],
                ["number", "Weft Node Thickness Jitter", "weftNodeThicknessJitter", 0.05, {
                    min: 0,
                    max: 1,
                    step: 0.01,
                    precision: 2
                }],

                ["number", "warpMinSlubLen", "warpMinSlubLen", 7, { min: 1, max: 100 }],
                ["number", "warpMaxSlubLen", "warpMaxSlubLen", 9, { min: 1, max: 100 }],
                ["number", "warpMinSlubPause", "warpMinSlubPause", 17, { min: 1, max: 100 }],
                ["number", "warpMaxSlubPause", "warpMaxSlubPause", 25, { min: 1, max: 100 }],
                ["number", "warpMinSlubThickness", "warpMinSlubThickness", 1.23, { min: 1, max: 4, step: 0.1, precision: 2 }],
                ["number", "warpMaxSlubThickness", "warpMaxSlubThickness", 1.71, { min: 1, max: 4, step: 0.1, precision: 2 }],

                ["number", "weftMinSlubLen", "weftMinSlubLen", 7, { min: 1, max: 100 }],
                ["number", "weftMaxSlubLen", "weftMaxSlubLen", 9, { min: 1, max: 100 }],
                ["number", "weftMinSlubPause", "weftMinSlubPause", 17, { min: 1, max: 100 }],
                ["number", "weftMaxSlubPause", "weftMaxSlubPause", 25, { min: 1, max: 100 }],
                ["number", "weftMinSlubThickness", "weftMinSlubThickness", 1.23, { min: 1, max: 4, step: 0.1, precision: 2 }],
                ["number", "weftMaxSlubThickness", "weftMaxSlubThickness", 1.71, { min: 1, max: 4, step: 0.1, precision: 2 }],

                ["control", "save", "play"]

            ],

            behaviour: [
                ["check", "Fabric Imperfections", "renderFabricImperfections", 0],
                ["number", "Warp Pos Jitter", "warpPosJitter", 0.03, {
                    min: 0,
                    max: 1,
                    step: 0.01,
                    precision: 2
                }],
                ["number", "Weft Pos Jitter", "weftPosJitter", 0.03, {
                    min: 0,
                    max: 1,
                    step: 0.01,
                    precision: 2
                }],
                ["number", "Wp Node Pos Jitter", "warpNodePosJitter", 0.03, {
                    min: 0,
                    max: 1,
                    step: 0.01,
                    precision: 2
                }],
                ["number", "Wf Node Pos Jitter", "weftNodePosJitter", 0.03, {
                    min: 0,
                    max: 1,
                    step: 0.01,
                    precision: 2
                }],
                ["number", "Wp Wiggle Freq", "warpWiggleFrequency", 0.5, {
                    min: 0,
                    max: 1,
                    step: 0.01,
                    precision: 2
                }],
                ["number", "Wp Wiggle Range", "warpWiggleRange", 0.1, {
                    min: 0,
                    max: 1,
                    step: 0.01,
                    precision: 2
                }],
                ["number", "Wp Wiggle Inc", "warpWiggleInc", 0.01, {
                    min: 0,
                    max: 1,
                    step: 0.005,
                    precision: 3
                }],
                ["number", "Wf Wiggle Freq", "weftWiggleFrequency", 0.2, {
                    min: 0,
                    max: 1,
                    step: 0.01,
                    precision: 2
                }],
                ["number", "Wf Wiggle Range", "weftWiggleRange", 0.1, {
                    min: 0,
                    max: 1,
                    step: 0.01,
                    precision: 2
                }],
                ["number", "Wf Wiggle Inc", "weftWiggleInc", 0.01, {
                    min: 0,
                    max: 1,
                    step: 0.005,
                    precision: 3
                }],
                ["number", "Wp Float Lift%", "warpFloatLift", 0.5, {
                    min: 0,
                    max: 1,
                    step: 0.1,
                    precision: 2
                }],
                ["number", "Wf Float Lift%", "weftFloatLift", 0.5, {
                    min: 0,
                    max: 1,
                    step: 0.1,
                    precision: 2
                }],
                ["number", "Wp Distortion%", "warpFloatDistortionPercent", 25, {
                    min: 0,
                    max: 100
                }],
                ["number", "Wf Distortion%", "weftFloatDistortionPercent", 50, {
                    min: 0,
                    max: 100
                }],
                ["number", "Warp Expansion", "warpFloatExpansion", 0.25, {
                    min: 0,
                    max: 1,
                    step: 0.1,
                    precision: 2
                }],
                ["number", "Weft Expansion", "weftFloatExpansion", 0.25, {
                    min: 0,
                    max: 100,
                    step: 0.1,
                    precision: 2
                }],
                ["control", "save", "play"]
            ],

            export: [
                ["number", "X Repeats", "exportXRepeats", 1, {
                    min: 0.01,
                    max: 16384,
                    step: 1,
                    precision: 2,
                    col: "1/3"
                }],
                ["number", "Y Repeats", "exportYRepeats", 1, {
                    min: 0.01,
                    max: 16384,
                    step: 1,
                    precision: 2,
                    col: "1/3"
                }],
                ["number", "Warp Threads", "exportWarpThreads", 1, {
                    min: 2,
                    max: 16384,
                    step: 1,
                    col: "1/3"
                }],
                ["number", "Weft Threads", "exportWeftThreads", 1, {
                    min: 2,
                    max: 16384,
                    step: 1,
                    col: "1/3"
                }],
                ["number", "X Dimension (mm)", "exportXDimension", 1, {
                    min: 1,
                    max: 16384,
                    step: 0.1,
                    col: "1/3"
                }],
                ["number", "Y Dimension (mm)", "exportYDimension", 1, {
                    min: 1,
                    max: 16384,
                    step: 0.1,
                    col: "1/3"
                }],

                ["number", "Scale", "exportScale", 1, {
                    min: 1,
                    max: 16,
                    step: 1,
                    col: "1/3"
                }],
                ["number", "Quality", "exportQuality", 1, {
                    min: 1,
                    max: 16,
                    step: 1,
                    col: "1/3"
                }],

                ["number", "Render Width", "exportRenderWidth", 1, {
                    min: 2,
                    max: 16384,
                    step: 1,
                    col: "1/3"
                }],
                ["number", "Render Height", "exportRenderHeight", 1, {
                    min: 2,
                    max: 16384,
                    step: 1,
                    col: "1/3"
                }],
                ["number", "Output Width", "exportOutputWidth", 1, {
                    min: 2,
                    max: 16384,
                    step: 1,
                    col: "1/3"
                }],
                ["number", "Output Height", "exportOutputHeight", 1, {
                    min: 2,
                    max: 16384,
                    step: 1,
                    col: "1/3"
                }],
                ["check", "Info Frame", "exportInfoFrame", 1],
                ["control", "save", "play"]
            ],

            effects: [
                ["range", "Surface Puckering", "renderSurfacePuckering", 0, {
                    col: "1/1",
                    min: 0,
                    max: 100,
                    step: 5
                }],
                ["control", "save", "play"]
            ],

            settings: [
                ["number", "Algorithm", "renderAlgorithm", 0, {
                    min: 0,
                    max: 16
                }],
                ["check", "Wrinkles", "renderWrinkles", 1, {}],
                ["number", "smoothing", "thicknessSmoothing", 0, { min: 0, max: 12 }],
                ["number", "Texture", "renderWrinklesTexture", 0, { min: 0, max: 9 }],
                ["number", "X Factor", "renderWrinklesXFactor", 0, { min: -10, max: 10, precision: 2, step: 0.1 }],
                ["number", "Y Factor", "renderWrinklesYFactor", 0, { min: -10, max: 10, precision: 2, step: 0.1 }],
                ["number", "Z Factor", "renderWrinklesZFactor", 0, { min: -10, max: 10, precision: 2, step: 0.1 }],

                ["check", "Face Warp", "renderFaceWarpFloats", 1, {}],
                ["check", "Face Weft", "renderFaceWeftFloats", 1, {}],
                ["check", "Back Warp", "renderBackWarpFloats", 1, {}],
                ["check", "Back Weft", "renderBackWeftFloats", 1, {}],
                ["check", "Yarn Background", "renderYarnBackground", 1, {}],
                ["check", "Blur Background", "blurYarnBackground", 1, {}],
                ["check", "Yarn Base", "renderYarnBase", 1, {}],
                ["check", "Yarn Shadow", "renderYarnShadow", 1, {}],
                ["check", "Fringe", "renderFringe", 0, {}],
                ["number", "Fringe Ends", "renderFringeEnds", 0, {
                    min: 0,
                    max: 16
                }],
                ["number", "Fringe Picks", "renderFringePicks", 0, {
                    min: 0,
                    max: 16
                }],
                ["check", "Pinked", "renderPinked", 0, {}],
                ["control", "save", "play"]
            ]

        },

        setInterface: function(instanceId, render = true) {

            // console.log(["updateSimulationLayout", instanceId]);
            //logTime("updateSimulationLayout("+instanceId+")");

            var simulationBoxL = 0;
            var simulationBoxB = 0;
            var simulationBoxW = app.frame.width;
            var simulationBoxH = app.frame.height;

            $("#simulation-container").css({
                "width": simulationBoxW,
                "height": simulationBoxH,
                "left": simulationBoxL,
                "bottom": simulationBoxB,
            });

            if (q.simulation.scroll == undefined) {
                q.simulation.scroll = new Scrollbars({
                    id: "simulation",
                    parent: "simulation-frame",
                    view: "simulation-container",
                    onScroll: function(xy, pos) {
                        q.simulation.render("onScrollY");
                    }
                });
            }

            q.simulation.scroll.set({
                horizontal: {
                    show: false,
                    width: simulationBoxW,
                    right: 0,
                    bottom: 0
                },
                vertical: {
                    show: false,
                    height: simulationBoxH,
                    left: 0,
                    top: 0
                }
            });

            q.ctx(172, "simulation-container", "simulationDisplay", simulationBoxW, simulationBoxH, true, true);

            //q.context.simulationDisplay.clearRect(0, 0, simulationBoxW, simulationBoxH);

            q.position.update("simulation");

            q.simulation.ctxW = q.canvas.simulationDisplay.width;
            q.simulation.ctxH = q.canvas.simulationDisplay.height;

            //logTimeEnd("updateSimulationLayout("+instanceId+")");

        },

        update: function() {

            this.needsUpdate = true;
            q.model.fabric.needsUpdate = true;
            if (app.views.active == "simulation") {
                q.model.needsUpdate = true;
            }

        },

        addIPI: function(thickProfile, xNodes, yNodes, yarnSet, frequency, minLen, maxLen, minThickPercent, maxThickPercent) {
            let isWarp = yarnSet === "warp";
            let isWeft = !isWarp;
            let posLimit = isWarp ? yNodes - 1 : xNodes - 1;
            for (let n = 0; n < frequency; ++n) {
                let thickFactor = getRandomInt(minThickPercent, maxThickPercent) / 100;
                let ipLen = getRandomInt(minLen, maxLen);
                let ipPos = getRandomInt(1 - ipLen, posLimit);
                let ipStart = limitNumber(ipPos, 0, posLimit);
                let ipLast = limitNumber(ipPos + ipLen - 1, 0, posLimit);
                let a = isWarp ? getRandomInt(0, xNodes - 1) : getRandomInt(0, yNodes - 1);
                let nodei = 0;
                for (let b = ipStart; b <= ipLast; ++b) {
                    let x = isWarp ? a : b;
                    let y = isWeft ? a : b;
                    let i = y * xNodes + x;
                    let nodeThickFactor = Math.sin(nodei / (ipLen - 1) * Math.PI) * thickFactor;
                    nodeThickFactor = roundTo(nodeThickFactor, 4);
                    let jitter = getRandom(-thickFactor / 2, thickFactor / 2);
                    thickProfile[i] *= (1 + nodeThickFactor + jitter);
                    nodei++;
                }
            }
        },

        injectYarnThicknessPattern: function(yarnSet, colorCode, yarn_id, xNodes, yNodes) {

            let otherSet = yarnSet == "warp" ? "weft" : "warp";
            let yarn = q.graph.yarns[yarn_id];

            if (!yarn?.slub && !yarn?.imperfections) return;

            // Warp/Weft CM to Nodes Factor
            let factor = sp[otherSet + "Density"] / 2.54;
            let thicknessProfile = _p.thickness[yarnSet];
            let pattern = new Float32Array(xNodes * yNodes);
            pattern.fill(1);

            if (yarn?.slub) {
                let minSlub = Math.round(yarn.min_slub * factor);
                let maxSlub = Math.round(yarn.max_slub * factor);
                let minPause = Math.round(yarn.min_pause * factor);
                let maxPause = Math.round(yarn.max_pause * factor);
                let minThick = yarn.min_thickness;
                let maxThick = yarn.max_thickness;
                pattern = Textile.createYarnThicknessPattern(xNodes, yNodes, minSlub, maxSlub, minPause, maxPause, minThick, maxThick);
            }

            let j = 0;

            if (yarnSet == "warp") {
                let xs = Array.from(Array(xNodes).keys()).shuffle();
                for (let n = 0; n < xNodes; ++n) {
                    let x = xs[n];
                    if (_p.pattern.warp[x] == colorCode) {
                        let threadThicknessJitter = 1 + getRandom(-yarn.number_variation, yarn.number_variation) / 100;
                        for (let y = 0; y < yNodes; ++y) {
                            let i = y * xNodes + x;
                            let nodeThicknessJitter = 1 + getRandom(-yarn.uneveness, yarn.uneveness) / 100;
                            thicknessProfile[i] *= (pattern[j++] * threadThicknessJitter * nodeThicknessJitter);
                        }
                    }

                }

            } else {
                let ys = Array.from(Array(yNodes).keys()).shuffle();
                for (let n = 0; n < yNodes; ++n) {
                    let y = ys[n];
                    if (_p.pattern.weft[y] == colorCode) {
                        let threadThicknessJitter = 1 + getRandom(-yarn.number_variation, yarn.number_variation) / 100;
                        for (let x = 0; x < xNodes; ++x) {
                            let nodeThicknessJitter = 1 + getRandom(-yarn.uneveness, yarn.uneveness) / 100;
                            let i = y * xNodes + x;
                            thicknessProfile[i] *= (pattern[j++] * threadThicknessJitter * nodeThicknessJitter);
                        }
                    }
                }
            }

        },

        createProfiles: function(xNodes, yNodes, intersectionW, intersectionH, scrollX, scrollY, edgeNodes) {

            // setup scale is always 1. for higher quality and scale calculate at the time of render.
            // xNodes = Warp Ends to Render, yNodes = Weft Picks to Render, intersectionW/H in Pixels, scrollX/Y in threads, xScale Drawing Scale

            Debug.time("createProfiles");

            _p.pattern = {
                warp: [],
                weft: []
            };

            _p.thickness = {
                warp: new Float32Array(xNodes * yNodes),
                weft: new Float32Array(xNodes * yNodes)
            };

            _p.position = {
                x: new Float32Array(xNodes * yNodes),
                y: new Float32Array(xNodes * yNodes)
            };

            _p.startPos = {
                warp: new Float32Array(xNodes * yNodes),
                weft: new Float32Array(xNodes * yNodes)
            };

            _p.lastPos = {
                warp: new Float32Array(xNodes * yNodes),
                weft: new Float32Array(xNodes * yNodes)
            };

            _p.distortion = {
                warp: new Float32Array(xNodes * yNodes),
                weft: new Float32Array(xNodes * yNodes)
            };

            _p.deflection = {
                warp: new Float32Array(xNodes * yNodes),
                weft: new Float32Array(xNodes * yNodes)
            };

            for (let x = 0; x < xNodes; ++x) {
                let posx = loopNumber(x - scrollX, q.pattern.warp.length);
                let colorCode = q.pattern.warp[posx];
                _p.pattern.warp[x] = colorCode;
                let color = q.palette.colors[colorCode];
                let yarnId = sp.yarnConfig == "palette" ? color.yarnId : sp.warpYarnId;
                let yarn = q.graph.yarns[yarnId] !== undefined ? q.graph.yarns[yarnId] : q.graph.yarns.system_0;
                let yarnThickness = Textile.getYarnDia(yarn.number, yarn.number_system, "px", sp.screenDPI);
                for (let y = 0; y < yNodes; ++y) {
                    let i = y * xNodes + x;
                    _p.thickness.warp[i] = yarnThickness;
                    // Edge Threades are added for edge quality render. Edge Thread positions will be outside the canvas.
                    // So bottom left thread on final dispaly canvas will be the first thread on the woven plan. Not the edge thread which is added only for the edge imporovement.
                    _p.position.x[i] = intersectionW * (x + 0.5 - edgeNodes);
                }
            }

            for (let y = 0; y < yNodes; ++y) {
                let posy = loopNumber(y - scrollY, q.pattern.weft.length);
                let colorCode = q.pattern.weft[posy];
                _p.pattern.weft[y] = colorCode;
                let color = q.palette.colors[colorCode];
                let yarnId = sp.yarnConfig == "palette" ? color.yarnId : sp.weftYarnId;
                let yarn = q.graph.yarns[yarnId] !== undefined ? q.graph.yarns[yarnId] : q.graph.yarns.system_0;
                let yarnThickness = Textile.getYarnDia(yarn.number, yarn.number_system, "px", sp.screenDPI);
                for (let x = 0; x < xNodes; ++x) {
                    let i = y * xNodes + x;
                    _p.thickness.weft[i] = yarnThickness;
                    _p.position.y[i] = intersectionH * (y + 0.5 - edgeNodes);
                }
            }

            Debug.timeEnd("createProfiles", "simulation");

        },

        induceReedEffect: function(xNodes, yNodes) {

            Debug.time("induceReedEffect");

            let dentingEffect = [];
            if (sp.reedFill == 1) {
                dentingEffect = [0];
            } else if (sp.reedFill == 2) {
                dentingEffect = [0.5, -0.5];
            } else if (sp.reedFill == 3) {
                dentingEffect = [0.5, 0, -0.5];
            } else if (sp.reedFill == 4) {
                dentingEffect = [0.5, 0.25, -0.25, -0.5];
            } else if (sp.reedFill == 5) {
                dentingEffect = [0.5, 0.25, 0, -0.25, -0.5];
            } else if (sp.reedFill == 6) {
                dentingEffect = [0.5, 0.25, 0.125, -0.125, -0.25, -0.5];
            } else if (sp.reedFill == 7) {
                dentingEffect = [0.5, 0.25, 0.125, 0, -0.125, -0.25, -0.5];
            } else if (sp.reedFill == 8) {
                dentingEffect = [0.5, 0.25, 0.125, 0.0625, -0.0625, -0.125, -0.25, -0.5];
            }
            let dentingSpacePx = sp.dentingSpace / 25.4 * sp.screenDPI;
            let displacementX = 0;
            for (let x = 0; x < xNodes; ++x) {
                for (let y = 0; y < yNodes; ++y) {
                    let i = y * xNodes + x;
                    displacementX = dentingEffect[x % sp.reedFill];
                    _p.position.x[i] += dentingSpacePx * displacementX;
                }
            }

            Debug.timeEnd("induceReedEffect", "simulation");

        },

        createSurfacePuckering: async function(xNodes, yNodes) {
            let url = './simulation/puckering_02.png';
            let file = await imageToImageData(url);
            return new Promise((resolve, reject) => {
                let imageWidth = file.image.width;
                let imageHeight = file.image.height;
                let imageData = file.imageData;
                let factor = sp.renderSurfacePuckering / 100;
                let randomXStart = getRandomInt(0, imageWidth);
                let randomYStart = getRandomInt(0, imageHeight);
                for (let x = 0; x < xNodes; ++x) {
                    for (let y = 0; y < yNodes; ++y) {
                        let i = y * xNodes + x;
                        // RGB XYZ : Z being out of screen
                        let pixel_x = loopNumber(x + randomXStart, imageWidth);
                        let pixel_y = loopNumber(yNodes - y + randomYStart - 1, imageHeight);
                        let { r, g, b } = getPixelColorFromImageData(imageData, pixel_x, pixel_y, imageWidth);
                        let displacement_x = mapNumberToRange(r, 0, 255, 1, -1, false);
                        let displacement_y = mapNumberToRange(g, 0, 255, -1, 1, false);
                        let displacement_z = mapNumberToRange(b, 0, 255, -1, 1, false);
                        _p.position.x[i] += (displacement_x * factor);
                        _p.position.y[i] += (displacement_y * factor);
                        _p.thickness.warp[i] *= (1 + displacement_z * factor);
                        _p.thickness.weft[i] *= (1 + displacement_z * factor);
                    }
                }
                resolve();
            });
        },

        createWrinkles: async function(xNodes, yNodes) {

            //let url = `./simulation/test_normal_${sp.renderWrinklesTexture}.png`;
            let url = './simulation/fabric_wrinkles_02.jpg';

            let file = await imageToImageData(url);
            return new Promise((resolve, reject) => {
                let imageWidth = file.image.width;
                let imageHeight = file.image.height;
                let imageData = file.imageData;
                for (let x = 0; x < xNodes; ++x) {
                    for (let y = 0; y < yNodes; ++y) {
                        let i = y * xNodes + x;
                        // RGB XYZ : Z being out of screen
                        let pixel_x = loopNumber(x, imageWidth);
                        let pixel_y = loopNumber(yNodes - y - 1, imageHeight);
                        let { r, g, b } = getPixelColorFromImageData(imageData, pixel_x, pixel_y, imageWidth);
                        let displacement_x = mapNumberToRange(r, 0, 255, 1, -1, false);
                        let displacement_y = mapNumberToRange(g, 0, 255, 1, -1, false);
                        let displacement_z = mapNumberToRange(b, 0, 255, -1, 1, false);
                        _p.position.x[i] += (displacement_x * sp.renderWrinklesXFactor);
                        _p.position.y[i] += (displacement_y * sp.renderWrinklesYFactor);
                        _p.thickness.warp[i] *= (1 + displacement_z * sp.renderWrinklesZFactor);
                        _p.thickness.weft[i] *= (1 + displacement_z * sp.renderWrinklesZFactor);
                    }
                }

                resolve();
            });
        },

        thicknessSmoothing: function(xNodes, yNodes, strength = 1) {
            let smoothProfile = {
                warp: new Float32Array(xNodes * yNodes),
                weft: new Float32Array(xNodes * yNodes)
            };
            for (let s = 0; s < strength; s++) {
                for (let y = 0; y < yNodes; ++y) {
                    for (let x = 0; x < xNodes; ++x) {
                        let i = y * xNodes + x;
                        let n = _p.thickness.weft[i + 1] ?? _p.thickness.weft[i];
                        let p = _p.thickness.weft[i - 1] ?? _p.thickness.weft[i];
                        smoothProfile.weft[i] = (n + p) / 2;
                    }
                }
                for (let x = 0; x < xNodes; ++x) {
                    for (let y = 0; y < yNodes; ++y) {
                        let i = y * xNodes + x;
                        let n = _p.thickness.warp[i + 1] ?? _p.thickness.warp[i];
                        let p = _p.thickness.warp[i - 1] ?? _p.thickness.warp[i];
                        smoothProfile.warp[i] = (n + p) / 2;
                    }
                }
                _p.thickness.weft = smoothProfile.weft;
                _p.thickness.warp = smoothProfile.warp;
            }
        },

        addYarnImperfectionsToThicknessProfile: function(xNodes, yNodes, ctxW, ctxH, warpDensity, weftDensity) {

            return new Promise((resolve, reject) => {

                Debug.time("addYarnImperfectionsToThicknessProfile");

                // Nep 1mm-5mm
                // thick 50% fault 6mm-30mm
                // thin 50% fault : 4mm-20mm

                // 60s IPI 10,40,80

                var totalWarpYarnKmInView = ctxH / sp.screenDPI * xNodes / 39.37 / 1000 / sp.renderQuality;
                var totalWeftYarnKmInView = ctxW / sp.screenDPI * yNodes / 39.37 / 1000 / sp.renderQuality;

                var warpYarnThinPlaces = Math.round(sp.warpThins * totalWarpYarnKmInView);
                var warpYarnThickPlaces = Math.round(sp.warpThicks * totalWarpYarnKmInView);
                var warpYarnNeps = Math.round(sp.warpNeps * totalWarpYarnKmInView);

                var warpYarnThinPlaceMinLength = Math.round(4 / 25.4 * warpDensity);
                var warpYarnThinPlaceMaxLength = Math.round(20 / 25.4 * warpDensity);

                var warpYarnThickPlaceMinLength = Math.round(6 / 25.4 * warpDensity);
                var warpYarnThickPlaceMaxLength = Math.round(30 / 25.4 * warpDensity);

                var warpYarnNepMinLength = Math.round(1 / 25.4 * warpDensity);
                var warpYarnNepMaxLength = Math.round(5 / 25.4 * warpDensity);

                var weftYarnThinPlaces = Math.round(sp.weftThins * totalWeftYarnKmInView);
                var weftYarnThickPlaces = Math.round(sp.weftThicks * totalWeftYarnKmInView);
                var weftYarnNeps = Math.round(sp.weftNeps * totalWeftYarnKmInView);

                var weftYarnThinPlaceMinLength = Math.round(4 / 25.4 * weftDensity);
                var weftYarnThinPlaceMaxLength = Math.round(20 / 25.4 * weftDensity);

                var weftYarnThickPlaceMinLength = Math.round(6 / 25.4 * weftDensity);
                var weftYarnThickPlaceMaxLength = Math.round(30 / 25.4 * weftDensity);

                var weftYarnNepMinLength = Math.round(1 / 25.4 * weftDensity);
                var weftYarnNepMaxLength = Math.round(5 / 25.4 * weftDensity);

                this.addIPI(_p.thickness.warp, xNodes, yNodes, "warp", warpYarnThinPlaces, warpYarnThinPlaceMinLength, warpYarnThinPlaceMaxLength, -25, -25);
                this.addIPI(_p.thickness.warp, xNodes, yNodes, "warp", warpYarnThickPlaces, warpYarnThickPlaceMinLength, warpYarnThickPlaceMaxLength, 50, 50);
                this.addIPI(_p.thickness.warp, xNodes, yNodes, "warp", warpYarnNeps, warpYarnNepMinLength, warpYarnNepMaxLength, 100, 200);
                this.addIPI(_p.thickness.weft, xNodes, yNodes, "weft", weftYarnThinPlaces, weftYarnThinPlaceMinLength, weftYarnThinPlaceMaxLength, -25, -25);
                this.addIPI(_p.thickness.weft, xNodes, yNodes, "weft", weftYarnThickPlaces, weftYarnThickPlaceMinLength, weftYarnThickPlaceMaxLength, 50, 50);
                this.addIPI(_p.thickness.weft, xNodes, yNodes, "weft", weftYarnNeps, weftYarnNepMinLength, weftYarnNepMaxLength, 100, 200);

                // var ip, jp, kp, it, jt, kt, i, j, k, n, x, y;

                // // Position adjustment for IPIs
                // for (n = 0; n < 2; ++n) {

                // 	// warp IPI Distortion Normalise
                // 	for (y = 0; y < yNodes; ++y) {
                // 		for (x = 2; x < xNodes-2; ++x) {
                // 			i = y * xNodes + x;
                // 			j = i + 1;
                // 			k = i + 2;
                // 			ip = _p.position.x[i];
                // 			jp = _p.position.x[j];
                // 			kp = _p.position.x[k];
                // 			it = _p.thickness.warp[i];
                // 			jt = _p.thickness.warp[j];
                // 			kt = _p.thickness.warp[k];
                // 			_p.position.x[j] = (kp-kt/2+ip+it/2)/2;
                // 		}

                // 	}

                // 	for (x = 0; x < xNodes; ++x) {
                // 		for (y = 2; y < yNodes-2; ++y) {
                // 			i = y * xNodes + x;
                // 			j = i + xNodes;
                // 			k = j + xNodes;
                // 			ip = _p.position.y[i];
                // 			jp = _p.position.y[j];
                // 			kp = _p.position.y[k];
                // 			it = _p.thickness.weft[i];
                // 			jt = _p.thickness.weft[j];
                // 			kt = _p.thickness.weft[k];
                // 			_p.position.y[j] = (kp-kt/2+ip+it/2)/2;
                // 		}

                // 	}

                // }

                Debug.timeEnd("addYarnImperfectionsToThicknessProfile", "simulation");

                resolve();

            });

        },

        renderToExport: function(renderW, renderH, exportW, exportH, frame = false) {
            var ctx_render = q.ctx(61, "noshow", "simulationRender", renderW, renderH, true, false);
            var loadingbar = new Loadingbar("simulationRenderTo", "Preparing Simulation", true, true);
            q.simulation.renderTo(ctx_render, renderW, renderH, 0, 0, sp.zoom, sp.zoom, sp.renderQuality, async function() {
                if (renderW !== exportW || renderH !== exportH) {
                    var ctx_export = q.ctx(61, "noshow", "simulationExport", exportW, exportH, false, false);
                    await picaResize(ctx_render, ctx_export);
                    ctx_render = ctx_export;
                }

                if (frame) {
                    let border = 10;
                    let frameW = exportW + 20;
                    let frameH = exportH + 60;
                    let ctx_frame = q.ctx(61, "noshow", "simulationFrame", frameW, frameH, false, false);

                    ctx_frame.fillStyle = '#F0F0F0';
                    ctx_frame.fillRect(0, 0, frameW, frameH);

                    ctx_frame.fillStyle = '#FFFFFF';
                    ctx_frame.fillRect(border - 1, border - 1, exportW + 2, exportH + 2);

                    ctx_frame.drawImage(ctx_render.canvas, border, border);

                    let logo = await Pdf.getImageFromURL(Pdf.wve_app_logo);
                    let logoW = logo.width;
                    let logoH = logo.height;
                    ctx_frame.drawImage(logo, Math.round(frameW / 2) - Math.round(logoW / 2), frameH - border - logoH);

                    ctx_frame.textAlign = "center";
                    ctx_frame.fillStyle = '#222222';
                    ctx_frame.font = "10px Verdana";
                    ctx_frame.fillText(app.project.title, frameW / 2, frameH - 30);

                    ctx_render = ctx_frame;
                }

                saveCanvasAsImage(ctx_render.canvas, "simulation-image.png");
                loadingbar.remove();

            });
        },

        renderToDataurl: function(callback){
            var canvasW = 1000;
            var canvasH = 1000;
            var context = get_ctx('server_save_simulation_dataurl_canvas', 'noshow', canvasW, canvasH);
            var loadingbar = new Loadingbar("simulationRenderTo", "Preparing Simulation", true, true);
            this.renderTo(context, canvasW, canvasH, 0, 0, sp.zoom, sp.zoom, sp.renderQuality, function() {
                var dataurl = context.canvas.toDataURL("image/png");
                var unixTimeStamp = Math.round((new Date()).getTime() / 1000).toString(16).toUpperCase();
                var fileName = "dobby_simulation_" + unixTimeStamp;
                saveDataurlToServer(dataurl, fileName).then((res) => {
                    if ( res == "0" ){
                        console.log("Simulation save: fail!");
                    } else {
                        console.log("Simulation save: " + res);
                    }
                    loadingbar.remove();
                    callback();
                });
            });
        },

        // Simulation
        render: function(instanceId) {
            Debug.time("simulation.render");
            var loadingbar = new Loadingbar("simulationRenderTo", "Preparing Simulation", true, true);
            this.renderTo(q.context.simulationDisplay, this.ctxW, this.ctxH, this.scroll.x, this.scroll.y, sp.zoom, sp.zoom, sp.renderQuality, function() {
                q.simulation.needsUpdate = false;
                q.simulation.created = true;
                loadingbar.remove();
                Debug.timeEnd("simulation.render", "perfS");
            });
        },

        get intersection() {
            var intersectionW, intersectionH;
            if (sp.mode == "quick") {
                intersectionW = sp.warpSize + sp.warpSpace;
                intersectionH = sp.weftSize + sp.weftSpace;
            } else if (sp.mode == "scaled") {
                intersectionW = sp.screenDPI / sp.warpDensity;
                intersectionH = sp.screenDPI / sp.weftDensity;
            }
            return {
                width: {
                    px: intersectionW,
                    mm: intersectionW / sp.screenDPI * 25.4
                },
                height: {
                    px: intersectionH,
                    mm: intersectionH / sp.screenDPI * 25.4
                }
            };
        },

        get renderingSize() {

            var warpDensity, weftDensity;
            var intersectionW, intersectionH;
            var width_px, height_px;
            var width_mm, height_mm;

            var weave = q.graph.weave2D8;
            var weaveW = weave.length;
            var weaveH = weave[0].length;

            var fabricRepeatW = [weaveW, q.pattern.warp.length].lcm();
            var fabricRepeatH = [weaveH, q.pattern.weft.length].lcm();

            if (sp.mode == "quick") {

                intersectionW = sp.warpSize + sp.warpSpace;
                intersectionH = sp.weftSize + sp.weftSpace;

                warpDensity = sp.screenDPI / intersectionW;
                weftDensity = sp.screenDPI / intersectionH;

                width_px = Math.round(fabricRepeatW * intersectionW);
                height_px = Math.round(fabricRepeatH * intersectionH);

                width_mm = width_px / sp.screenDPI * 25.4;
                height_mm = height_px / sp.screenDPI * 25.4;

            } else if (sp.mode == "scaled") {

                warpDensity = sp.warpDensity;
                weftDensity = sp.weftDensity;

                intersectionW = sp.screenDPI / warpDensity;
                intersectionH = sp.screenDPI / weftDensity;

                width_px = Math.round(fabricRepeatW * intersectionW);
                height_px = Math.round(fabricRepeatH * intersectionH);

                width_mm = Math.round(fabricRepeatW / warpDensity * 25.4);
                height_mm = Math.round(fabricRepeatH / weftDensity * 25.4);

            }

            return {
                width: {
                    px: width_px,
                    mm: width_mm
                },
                height: {
                    px: height_px,
                    mm: height_mm
                }
            };

        },

        calculateDeflections: function(xNodes, yNodes) {

            let i, x, y, sx, sy, lx, ly, n, set, floats, count, float;
            let leftWarpFloatSize, rightWarpFloatSize;

            q.graph.floats.face.sizes.forEach(function(floatSize) {

                if (floatSize > 1) {
                    floats = q.graph.floats.face[floatSize];
                    count = floats.length;
                    for (n = 0; n < count; ++n) {
                        float = floats[n];
                        set = float.yarnSet;

                        if (set == "weft") {
                            sx = float.end - 1;
                            lx = sx + floatSize;
                            y = float.pick - 1;

                            var lefti = y * xNodes + sx - 1;
                            var righti = y * xNodes + lx + 1;
                            // leftWarpFloatSize = q.graph.floats.sizeProfile.warp[lefti];
                            // rightWarpFloatSize = q.graph.floats.sizeProfile.warp[righti];
                            for (let m = 0; m < floatSize; ++m) {
                                i = y * xNodes + sx + m;
                                _p.deflection.weft[i] += mapNumberToRange(m, 0, floatSize - 1, 1, -1, false, false);
                            }

                        }

                    }
                }

            });

        },

        renderTo: async function(ctx, ctxW, ctxH, scrollX = 0, scrollY = 0, xScale = 1, yScale = 1, quality = 1, callback = false) {

            // console.log(arguments);
            let graphId = q.graphId(ctx.canvas.id);
            //console.log(["q.simulation.renderTo", graphId]);

            Debug.time("Total");
            Debug.time("Setup");

            let weave = q.graph.weave2D8;

            if (!weave || !weave.is2D8()) {
                console.log("renderWeaveError");
                return;
            }

            let weaveW = weave.length;
            let weaveH = weave[0].length;

            let ctx_output;

            if (sp.mode == "scaled" && quality > 1) {
                xScale *= quality;
                yScale *= quality;
                ctx_output = ctx;
                ctxW = Math.round(ctxW * quality);
                ctxH = Math.round(ctxH * quality);
                ctx = q.ctx(0, "noshow", "simulationDraw", ctxW, ctxH, true, false);
                ctx.clearRect(0, 0, ctxW, ctxH);
            }

            let pixels = q.pixels[ctx.canvas.id];
            let pixels8 = q.pixels8[ctx.canvas.id];
            let pixels32 = q.pixels32[ctx.canvas.id];

            if (sp.renderAlgorithm == 0 || sp.renderAlgorithm == 1 || sp.renderAlgorithm == 2) {
                let simulationBackground = hexToRgba1(sp.backgroundColor);
                buffRectSolid(app.origin, pixels8, pixels32, ctxW, ctxH, 0, 0, ctxW, ctxH, simulationBackground);
            } else {
                buffRectSolid(app.origin, pixels8, pixels32, ctxW, ctxH, 0, 0, ctxW, ctxH, { r: 255, g: 255, b: 255, a: 0 });
            }

            Debug.timeEnd("Setup", "simulation");
            Debug.time("Calculations");

            if (sp.mode === "quick") {

                let drawX, drawY;

                let yarnColors = {};
                let fillStyle = sp.drawMethod == "flat" ? "color32" : "gradient";
                ["warp", "weft"].forEach(yarnSet => {
                    let yarnThickness = sp[yarnSet + "Size"];
                    yarnColors[yarnSet] = {};
                    q.pattern.colors(yarnSet).forEach(code => {
                        if (fillStyle == "color32") {
                            yarnColors[yarnSet][code] = q.palette.colors[code].color32;
                        } else if ("gradient") {
                            yarnColors[yarnSet][code] = q.palette.getGradient(code, yarnThickness);
                        }
                    });
                });

                Debug.timeEnd("Calculations", "simulation");
                Debug.time("Calculations2");

                // let data = {
                //   				warp: q.pattern.warp,
                //   				weft: q.pattern.weft,
                //   				ends: weaveW,
                //   				picks: weaveH,
                //   				warpSize: sp.warpSize,
                //   				weftSize: sp.weftSize,
                //   				warpSpace: sp.warpSpace,
                //   				weftSpace: sp.weftSpace,
                //   				scrollX: scrollX,
                //   				scrollY: scrollY,
                //   				weave: q.graph.weaveBuffer,
                //   				pixels32Buffer: pixels32.buffer,
                //   				drawMethod: sp.drawMethod,
                //   				yarnColors: yarnColors,
                //   				ctxW: ctxW,
                //   				ctxH: ctxH,
                //   				fillStyle: sp.fillStyle,
                //   				origin: app.origin
                //   			};

                // simulationWorkerPromise(data).then(e => {
                // 	pixels32 = new Int32Array(e);
                // 	ctx.putImageData(pixels, 0, 0);

                // 	if (typeof callback === "function") callback();

                // 	Debug.timeEnd("warp floats", "simulation");
                // });

                // simulationWorker.postMessage({
                // 	warp: q.pattern.warp,
                // 	weft: q.pattern.weft,
                // 	ends: weaveW,
                // 	picks: weaveH,
                // 	warpSize: sp.warpSize,
                // 	weftSize: sp.weftSize,
                // 	warpSpace: sp.warpSpace,
                // 	weftSpace: sp.weftSpace,
                // 	scrollX: scrollX,
                // 	scrollY: scrollY,
                // 	weave: q.graph.weaveBuffer,
                // 	pixels32: pixels32.buffer,
                // 	drawMethod: sp.drawMethod,
                // 	yarnColors: yarnColors,
                // 	ctxW: ctxW,
                // 	ctxH: ctxH,
                // 	fillStyle: sp.fillStyle,
                // 	origin: app.origin
                // });

                weave = weave.transform2D8("112", "shiftxy", scrollX, scrollY);
                Debug.timeEnd("Calculations2", "simulation");

                let pattern = {
                    warp: q.pattern.warp.shift1D(scrollX),
                    weft: q.pattern.weft.shift1D(scrollY)
                };

                let intersectionW = sp.warpSize + sp.warpSpace;
                let intersectionH = sp.weftSize + sp.weftSpace;

                Debug.time("Draw");

                let halfWarpSpace = Math.floor(sp.warpSpace / 2);
                let halfWeftSpace = Math.floor(sp.weftSpace / 2);

                let xIntersections = Math.ceil(ctxW / intersectionW);
                let yIntersections = Math.ceil(ctxH / intersectionH);

                Debug.time("full warp");

                // warp full threads
                for (let x = 0; x < xIntersections; ++x) {
                    drawX = x * intersectionW + halfWarpSpace;
                    let code = pattern.warp[x % pattern.warp.length];
                    drawRectBuffer(app.origin, pixels32, drawX, 0, sp.warpSize, ctxH, ctxW, ctxH, fillStyle, yarnColors.warp[code], 1, "h");
                }

                Debug.timeEnd("full warp", "simulation");

                Debug.time("full weft");

                // weft full threads
                for (let y = 0; y < yIntersections; ++y) {
                    drawY = y * intersectionH + halfWeftSpace;
                    let code = pattern.weft[y % pattern.weft.length];
                    drawRectBuffer(app.origin, pixels32, 0, drawY, ctxW, sp.weftSize, ctxW, ctxH, fillStyle, yarnColors.weft[code], 1, "v");
                }

                Debug.timeEnd("full weft", "simulation");

                Debug.time("warp floats");

                // warp floats
                for (let x = 0; x < xIntersections; ++x) {
                    let arrX = loopNumber(x, weaveW);
                    drawX = x * intersectionW + halfWarpSpace;
                    let code = pattern.warp[x % pattern.warp.length];
                    for (let y = 0; y < yIntersections; ++y) {
                        let arrY = loopNumber(y, weaveH);
                        drawY = y * intersectionH;
                        if (weave[arrX][arrY]) {
                            drawRectBuffer(app.origin, pixels32, drawX, drawY, sp.warpSize, intersectionH, ctxW, ctxH, fillStyle, yarnColors.warp[code], 1, "h");
                        }
                    }
                }

                ctx.putImageData(pixels, 0, 0);

                if (typeof callback === "function") callback();

                Debug.timeEnd("warp floats", "simulation");

            } else if (sp.mode === "scaled") {

                await delay(10);

                let i, j;

                let warpDensity = sp.warpDensity;
                let weftDensity = sp.weftDensity;
                let intersectionW = sp.screenDPI / warpDensity;
                let intersectionH = sp.screenDPI / weftDensity;

                let edgeNodes = 12; // Extra Threads on each sides for seamless rendering

                let xNodes = Math.ceil(ctxW / intersectionW / xScale) + edgeNodes * 2;
                let yNodes = Math.ceil(ctxH / intersectionH / yScale) + edgeNodes * 2;

                scrollX += edgeNodes;
                scrollY += edgeNodes;

                q.graph.floats.find(weave, {
                    w: xNodes,
                    h: yNodes,
                    sx: scrollX,
                    sy: scrollY,
                    shuffle: sp.fuzzySurface
                });
                q.simulation.createProfiles(xNodes, yNodes, intersectionW, intersectionH, scrollX, scrollY, edgeNodes);
                q.simulation.induceReedEffect(xNodes, yNodes, xScale);


                if (sp.renderSurfacePuckering) await q.simulation.createSurfacePuckering(xNodes, yNodes);
                if (sp.renderWrinkles) await q.simulation.createWrinkles(xNodes, yNodes);

                if (sp.thicknessSmoothing) q.simulation.thicknessSmoothing(xNodes, yNodes, sp.thicknessSmoothing);

                let floatGradients = [];

                let shadei;
                let shade32;

                let warpPosJitter = 0;
                let weftPosJitter = 0;
                let warpThicknessJitter = 0;
                let weftThicknessJitter = 0;

                let warpNodePosJitter = 0;
                let weftNodePosJitter = 0;
                let warpNodeThicknessJitter = 0;
                let weftNodeThicknessJitter = 0;

                let warpfloatLiftFactor = 0;
                let weftfloatLiftFactor = 0;
                let warpFloatDistortionFactor = 0;
                let weftFloatDistortionFactor = 0;

                let warpWiggleRange = 0;
                let warpWiggleInc = 0;
                let warpWiggleFrequency = 0;
                let warpWiggle = 0;

                let weftWiggleRange = 0;
                let weftWiggleInc = 0;
                let weftWiggleFrequency = 0;
                let weftWiggle = 0;

                Debug.timeEnd("Calculations", "simulation");

                if (sp.renderFabricImperfections) {

                    Debug.time("Fabric Imperfections");

                    warpPosJitter = sp.warpPosJitter;
                    weftPosJitter = sp.weftPosJitter;
                    warpThicknessJitter = sp.warpThicknessJitter;
                    weftThicknessJitter = sp.weftThicknessJitter;

                    warpNodePosJitter = sp.warpNodePosJitter;
                    weftNodePosJitter = sp.weftNodePosJitter;
                    warpNodeThicknessJitter = sp.warpNodeThicknessJitter;
                    weftNodeThicknessJitter = sp.weftNodeThicknessJitter;

                    warpfloatLiftFactor = sp.warpFloatLift / 100;
                    weftfloatLiftFactor = sp.weftFloatLift / 100;
                    warpFloatDistortionFactor = sp.warpFloatDistortionPercent / 100;
                    weftFloatDistortionFactor = sp.weftFloatDistortionPercent / 100;

                    warpWiggleRange = sp.warpWiggleRange;
                    warpWiggleInc = sp.warpWiggleInc;
                    warpWiggleFrequency = sp.warpWiggleFrequency;

                    weftWiggleRange = sp.weftWiggleRange;
                    weftWiggleInc = sp.weftWiggleInc;
                    weftWiggleFrequency = sp.weftWiggleFrequency;

                    for (let x = 0; x < xNodes; ++x) {

                        if (sp.renderFabricImperfections) {
                            warpPosJitter = warpPosJitter ? getRandom(-sp.warpPosJitter, sp.warpPosJitter) : 0;
                            warpThicknessJitter = warpThicknessJitter ? getRandom(-sp.warpThicknessJitter, sp.warpThicknessJitter) : 0;
                        }

                        for (let y = 0; y < yNodes; ++y) {

                            warpWiggle = Math.random() < warpWiggleFrequency ? warpWiggle + warpWiggleInc : warpWiggle - warpWiggleInc;
                            warpWiggle = limitNumber(warpWiggle, -warpWiggleRange, warpWiggleRange);

                            warpNodePosJitter = warpNodePosJitter ? getRandom(-sp.warpNodePosJitter, sp.warpNodePosJitter) / 2 : 0;
                            warpNodeThicknessJitter = warpNodeThicknessJitter ? getRandom(-sp.warpNodeThicknessJitter, sp.warpNodeThicknessJitter) / 2 : 0;

                            i = y * xNodes + x;
                            let floatS = q.graph.floats.sizeProfile.warp[i];
                            let floatSAbs = Math.abs(floatS);
                            let floatNode = q.graph.floats.nodeProfile.warp[i];
                            let nodePosRelativeToCenter = centerRatio(floatNode, floatSAbs, 3);

                            _p.position.x[i] += warpPosJitter + warpNodePosJitter + warpWiggle;
                            _p.thickness.warp[i] += warpThicknessJitter + warpNodeThicknessJitter;

                            // Float Node Thickness. Float is thin at start and end and thick at middle.
                            // _p.thickness.warp[i] *=  1 + nodePosRelativeToCenter;
                            if (floatNode && floatNode < floatSAbs - 1) {
                                _p.thickness.warp[i] *= 1 + sp.warpFloatExpansion;
                            }

                            // Intersection Distortion
                            if (floatNode === 0) {
                                _p.distortion.weft[i] += weftFloatDistortionFactor * 5;
                            }

                            if (floatNode == floatSAbs - 1) {
                                _p.distortion.weft[i] -= weftFloatDistortionFactor * 5;
                            }

                        }
                    }

                    for (let y = 0; y < yNodes; ++y) {

                        if (sp.renderFabricImperfections) {

                            weftPosJitter = weftPosJitter ? getRandom(-sp.weftPosJitter, sp.weftPosJitter) : 0;
                            weftThicknessJitter = weftThicknessJitter ? getRandom(-sp.weftThicknessJitter, sp.weftThicknessJitter) : 0;

                        }

                        for (let x = 0; x < xNodes; ++x) {

                            weftWiggle = Math.random() < weftWiggleFrequency ? weftWiggle + weftWiggleInc : weftWiggle - weftWiggleInc;
                            weftWiggle = limitNumber(weftWiggle, -weftWiggleRange, weftWiggleRange);

                            weftNodePosJitter = weftNodePosJitter ? getRandom(-sp.weftNodePosJitter, sp.weftNodePosJitter) / 2 : 0;
                            weftNodeThicknessJitter = weftNodeThicknessJitter ? getRandom(-sp.weftNodeThicknessJitter, sp.weftNodeThicknessJitter) / 2 : 0;

                            i = y * xNodes + x;

                            // Weft Node Position
                            let floatS = q.graph.floats.sizeProfile.weft[i];
                            let floatSAbs = Math.abs(floatS);
                            let floatNode = q.graph.floats.nodeProfile.weft[i];
                            let nodePosRelativeToCenter = centerRatio(floatNode, floatSAbs, 3);

                            _p.position.y[i] += weftPosJitter + weftNodePosJitter + weftWiggle;

                            // Weft Node Thickness
                            _p.thickness.weft[i] += weftThicknessJitter + weftNodeThicknessJitter;

                            // Float Node Thickness. Float is thin at start and end and thick at middle.
                            //_p.thickness.weft[i] *=  1 + nodePosRelativeToCenter;
                            if (floatNode && floatNode < floatSAbs - 1) {
                                _p.thickness.weft[i] *= 1 + sp.weftFloatExpansion;
                            }

                            // Intersection Distortion
                            if (floatNode === 0) {
                                _p.distortion.warp[i] += warpFloatDistortionFactor * 5;
                            }

                            if (floatNode == floatSAbs - 1) {
                                _p.distortion.warp[i] -= warpFloatDistortionFactor * 5;
                            }

                        }
                    }

                    Debug.timeEnd("Fabric Imperfections", "simulation");

                }

                // Render Yarn Material
                q.pattern.colors("warp").forEach(function(c) {
                    let yarn_id = sp.yarnConfig == "biset" ? sp.warpYarnId : q.palette.colors[c].yarnId;
                    q.simulation.injectYarnThicknessPattern("warp", c, yarn_id, xNodes, yNodes);
                });

                q.pattern.colors("weft").forEach(function(c) {
                    let yarn_id = sp.yarnConfig == "biset" ? sp.weftYarnId : q.palette.colors[c].yarnId;
                    q.simulation.injectYarnThicknessPattern("weft", c, yarn_id, xNodes, yNodes);
                });

                if (sp.renderYarnImperfections) {
                    await q.simulation.addYarnImperfectionsToThicknessProfile(xNodes, yNodes, ctxW, ctxH, warpDensity, weftDensity);
                }

                if (sp.renderFabricImperfections) {

                    Debug.time("Distortions");

                    for (let n = 0; n < 2; ++n) {

                        // warp Float Distortion Normalize
                        for (let x = 0; x < xNodes; ++x) {
                            for (let y = 1; y < yNodes - 1; ++y) {
                                i = y * xNodes + x;
                                j = i + xNodes;
                                _p.distortion.warp[i] = (_p.distortion.warp[i] + _p.distortion.warp[j]) / 2;
                                _p.distortion.warp[j] = (_p.distortion.warp[i] + _p.distortion.warp[j]) / 2;
                            }
                        }

                        // warp Float Distortion Normalize
                        for (let y = 0; y < yNodes; ++y) {
                            for (let x = 1; x < xNodes - 1; ++x) {
                                i = y * xNodes + x;
                                j = i + 1;
                                _p.distortion.weft[i] = (_p.distortion.weft[i] + _p.distortion.weft[j]) / 2;
                                _p.distortion.weft[j] = (_p.distortion.weft[i] + _p.distortion.weft[j]) / 2;
                            }
                        }

                        // warp Float Distortion Normalize
                        for (let x = 0; x < xNodes; ++x) {
                            for (let y = 1; y < yNodes - 1; ++y) {
                                i = y * xNodes + x;
                                j = i - xNodes;
                                _p.distortion.warp[i] = (_p.distortion.warp[i] + _p.distortion.warp[j]) / 2;
                                _p.distortion.warp[j] = (_p.distortion.warp[i] + _p.distortion.warp[j]) / 2;
                            }
                        }

                        // warp Float Distortion Normalize
                        for (let y = 0; y < yNodes; ++y) {
                            for (let x = 1; x < xNodes - 1; ++x) {
                                i = y * xNodes + x;
                                j = i - 1;
                                _p.distortion.weft[i] = (_p.distortion.weft[i] + _p.distortion.weft[j]) / 2;
                                _p.distortion.weft[j] = (_p.distortion.weft[i] + _p.distortion.weft[j]) / 2;
                            }
                        }
                    }

                    // node distortions
                    for (let x = 0; x < xNodes; ++x) {
                        for (let y = 0; y < yNodes; ++y) {
                            i = y * xNodes + x;
                            _p.position.y[i] += _p.distortion.weft[i];
                            _p.position.x[i] += _p.distortion.warp[i];
                            // _p.position.y[i] += 0;
                            // _p.position.x[i] += 0;
                        }
                    }

                    Debug.timeEnd("Distortions", "simulation");

                }

                // Float Distortion
                for (let x = 0; x < xNodes; ++x) {
                    for (let y = 0; y < yNodes; ++y) {
                        i = y * xNodes + x;
                        j = i + xNodes;
                        _p.distortion.warp[i] = (_p.distortion.warp[i] + _p.distortion.warp[j]) / 2;
                        _p.distortion.warp[j] = (_p.distortion.warp[i] + _p.distortion.warp[j]) / 2;
                    }

                }

                Debug.time("Floats");

                /*
				// Affecting Warp, Affected Weft Floating Distortion
				for (let x = 1; x < xNodes-1; ++x) {
					for (let y = 1; y < yNodes-1; ++y) {

                        var i = y * xNodes + x;
		
						let floatS = q.graph.floats.sizeProfile.warp[i];
						let floatSAbs = Math.abs(floatS);
						let floatNode = q.graph.floats.nodeProfile.warp[i];
						let floatCenter = floatS/2;
                        
                        var li = y * xNodes + x - 1;
                        var ri = y * xNodes + x + 1;

						let lFloatS = q.graph.floats.sizeProfile.weft[li];
						let rFloatS = q.graph.floats.sizeProfile.weft[ri];

                        var bi = (y-1) * xNodes + x;
                        bar ti = (y+1) * xNodes + x;
		
						let bFloatS = q.graph.floats.sizeProfile.warp[bi];
						let tFloatS = q.graph.floats.sizeProfile.warp[ti];
		
						let yDistortion = floatSAbs > 1 ? (floatCenter - floatNode) * smallerRatio(lFloatS, rFloatS) : 0;
		
						i = y * xNodes + x;
						// _p.position.y[i] += yDistortion * FloatDistortionFactor ;
					}
				}
				*/

                // q.simulation.calculateDeflections(xNodes, yNodes);

                // node distortions
                // for (let x = 0; x < xNodes; ++x) {
                // 	for (let y = 0; y < yNodes; ++y) {
                // 		i = y * xNodes + x;
                // 		_p.position.y[i] += _p.deflection.weft[i];
                // 		_p.position.x[i] += _p.deflection.warp[i];
                // 	}
                // }

                Debug.time("Floats", "simulation");

                Debug.time("Draw");

                let gradientData;

                let warpColors = q.pattern.colors("warp");
                let weftColors = q.pattern.colors("weft");
                let fabricColors = q.pattern.colors("fabric");

                // Float Gradient Data
                for (let c = 0; c < warpColors.length; c++) {
                    let code = warpColors[c];
                    gradientData = q.palette.colors[code].gradientData;
                    for (i = 0; i < q.graph.floats.warp.face.length; i++) {
                        let floatL = q.graph.floats.warp.face[i];
                        floatGradients[code + "-" + floatL] = [];
                        for (let nodei = 0; nodei < floatL; nodei++) {
                            shadei = Math.ceil(q.palette.gradientL / (floatL + 1) * (nodei + 1)) - 1;
                            shade32 = getPixelRGBA(gradientData, shadei);
                            floatGradients[code + "-" + floatL][nodei] = shade32;
                        }
                    }
                    floatGradients[code + "-light"] = getPixelRGBA(gradientData, 1);
                    floatGradients[code + "-dark"] = getPixelRGBA(gradientData, q.palette.gradientL - 1);
                }

                for (let c = 0; c < weftColors.length; c++) {
                    let code = weftColors[c];
                    gradientData = q.palette.colors[code].gradientData;
                    for (i = 0; i < q.graph.floats.weft.face.length; i++) {
                        let floatL = q.graph.floats.weft.face[i];
                        floatGradients[code + "-" + floatL] = [];
                        for (let nodei = 0; nodei < floatL; nodei++) {
                            shadei = Math.ceil(q.palette.gradientL / (floatL + 1) * (nodei + 1)) - 1;
                            shade32 = getPixelRGBA(gradientData, shadei);
                            floatGradients[code + "-" + floatL][nodei] = shade32;
                        }
                    }
                    floatGradients[code + "-light"] = getPixelRGBA(gradientData, 1);
                    floatGradients[code + "-dark"] = getPixelRGBA(gradientData, q.palette.gradientL - 1);
                }

                // Prepare Array of Floats to render
                let dFloats = [];

                for (let n = q.graph.floats.back.sizes.length - 1; n >= 0; --n) {
                    let floatS = q.graph.floats.back.sizes[n];
                    let floatsToRender = q.graph.floats.back[floatS];
                    for (i = 0; i < floatsToRender.length; i++) {
                        let floatObj = floatsToRender[i];
                        if ((sp.renderBackWeftFloats && floatObj.yarnSet == "weft") || (sp.renderBackWarpFloats && floatObj.yarnSet == "warp")) {
                            dFloats.push(floatObj);
                        }
                    }
                }

                let fabricColorsGroupByDenier = {};
                let paletteYarnDeniers = [];
                let yarnDenier;
                for (let n = 0; n < fabricColors.length; n++) {
                    let code = fabricColors[n];
                    let color = q.palette.colors[code];
                    yarnDenier = Textile.convertYarnNumber(color.yarn, color.system, "denier");
                    if (fabricColorsGroupByDenier[yarnDenier] == undefined) {
                        fabricColorsGroupByDenier[yarnDenier] = [];
                        paletteYarnDeniers.push(yarnDenier);
                    }
                    fabricColorsGroupByDenier[yarnDenier].push(code);
                }
                paletteYarnDeniers.sort((a, b) => a - b);

                // Draw Smallest Floats First
                for (let n = 0; n < q.graph.floats.face.sizes.length; ++n) {
                    // Draw Finer Yarn First
                    paletteYarnDeniers.forEach(function(denierToRender) {
                        let floatS = q.graph.floats.face.sizes[n];
                        let floatsToRender = q.graph.floats.face[floatS];
                        let floatCount = floatsToRender.length;
                        for (i = 0; i < floatCount; i++) {
                            let floatObj = floatsToRender[i];
                            if (fabricColorsGroupByDenier[denierToRender].includes(_p.pattern[floatObj.yarnSet][floatObj.threadi])) {
                                if ((sp.renderFaceWeftFloats && floatObj.yarnSet == "weft") || (sp.renderFaceWarpFloats && floatObj.yarnSet == "warp")) {
                                    dFloats.push(floatObj);
                                }
                            }
                        }
                    });
                }

                // Calculate Float Node Lengths
                for (i = 0; i < dFloats.length; i++) {
                    calculateNodeLengths(origin, ctxW, xNodes, yNodes, _p.position, _p.thickness, _p.startPos, _p.lastPos, dFloats[i]);
                }

                let renderParams = {
                    origin: app.origin,
                    pixels8: pixels8,
                    pixels32: pixels32,
                    ctxW: ctxW,
                    ctxH: ctxH,
                    xNodes: xNodes,
                    yNodes: yNodes,
                    xScale: xScale,
                    yScale: yScale,
                    profile: _p,
                    warpLift: sp.warpFloatLift,
                    weftLift: sp.weftFloatLift,
                    warpExpansion: sp.warpFloatExpansion,
                    weftExpansion: sp.weftFloatExpansion
                };

                if (sp.renderYarnBackground) {
                    Loadingbar.get("simulationRenderTo").title = "Rendering Yarn Background";
                    await renderFloatProperty("background", dFloats, renderParams);
                }

                if (sp.blurYarnBackground) {
                    Filter.blur(pixels8, ctxW, 1);
                }

                if (sp.renderYarnBase) {
                    Loadingbar.get("simulationRenderTo").title = "Rendering Yarn Base";
                    await renderFloatProperty("base", dFloats, renderParams);
                }

                if (sp.renderYarnShadow) {
                    Loadingbar.get("simulationRenderTo").title = "Rendering Yarn Shadows";
                    await renderFloatProperty("shadows", dFloats, renderParams);
                }

                ctx.putImageData(pixels, 0, 0);

                if (quality > 1) await picaResize(ctx, ctx_output);

                if (typeof callback === "function") callback();

            }

            Debug.timeEnd("Draw", "simulation");
            Debug.timeEnd("Total", "simulation");

        }

    };

    function renderFloatProperty(prop, floats, params) {

        params.algorithm = sp.renderAlgorithm;
        params.colors = q.palette.colors;

        return new Promise((resolve, reject) => {
            var floatCount = floats.length;
            var chunkSize = 8192;
            var chunkCount = Math.ceil(floatCount / chunkSize);

            if (!chunkCount) return resolve();

            var percentagePerChunk = 100 / chunkCount;
            var cycle = 0;
            var startfloatIndex = 0;
            var lastfloatIndex = chunkCount == 1 ? floatCount - 1 : chunkSize - 1;
            let loadingbar = Loadingbar.get("simulationRenderTo");

            $.doTimeout("floatDraw", 10, function() {
                for (var i = startfloatIndex; i <= lastfloatIndex; ++i) {
                    // drawFloat(...px, ...profiles, xNodes, yNodes, q.palette.colors, xScale, yScale, prop, sp.renderAlgorithm, floats[i]);
                    drawFloat(prop, floats[i], params);
                }
                if (loadingbar) loadingbar.progress = ++cycle * percentagePerChunk;
                if (lastfloatIndex >= floatCount - 1) {
                    resolve();
                    return false;
                }
                startfloatIndex = i;
                lastfloatIndex = limitNumber(startfloatIndex + chunkSize - 1, 0, floatCount - 1);
                return true;
            });

        });
    }

    function getGraphMouse(graph, clientx, clienty) {

        Debug.item("getGraphMouse.clientxy", clientx + ", " + clienty, "mouse");

        let mouse = false;

        if (graph && graph.in("weave", "threading", "lifting", "tieup", "warp", "weft", "artwork", "three", "model", "simulation")) {

            mouse = {};

            let origin = app.origin;
            let pointw = 1;
            let pointh = 1;
            let offsetx = 0;
            let offsety = 0;
            let rowLimit = 0;
            let colLimit = 0;

            if (app.views.active == "graph") {
                pointw = q.graph.scroll.point.w;
                pointh = q.graph.scroll.point.h;
                offsetx = q.graph.scroll.x;
                offsety = q.graph.scroll.y;
            }

            if (graph == "weave") {
                colLimit = gp.seamlessWeave ? q.graph.weave2D8.length : 0;
                rowLimit = gp.seamlessWeave ? q.graph.weave2D8[0].length : 0;

            } else if (graph == "threading") {
                offsety = q.tieup.scroll.y;
                colLimit = gp.seamlessThreading ? q.graph.threading2D8.length : 0;

            } else if (graph == "lifting") {
                offsetx = q.tieup.scroll.x;
                rowLimit = gp.seamlessLifting ? q.graph.lifting2D8.length : 0;

            } else if (graph == "tieup") {
                offsetx = q.tieup.scroll.x;
                offsety = q.tieup.scroll.y;

            } else if (graph == "warp") {
                pointh = app.ui.patternSpan;
                colLimit = gp.seamlessWarp ? q.pattern.warp.length : 0;

            } else if (graph == "weft") {
                pointw = app.ui.patternSpan;
                rowLimit = gp.seamlessWeft ? q.pattern.weft.length : 0;

            } else if (graph == "artwork") {
                pointw = q.artwork.scroll.point.w;
                pointh = q.artwork.scroll.point.h;
                offsetx = q.artwork.scroll.x;
                offsety = q.artwork.scroll.y;
                let artworkLoaded = q.artwork.width && q.artwork.height;
                colLimit = artworkLoaded && ap.seamlessX ? q.artwork.width : 0;
                rowLimit = artworkLoaded && ap.seamlessY ? q.artwork.height : 0;

            } else if (graph == "simulation") {

            } else if (graph == "three") {

            } else if (graph == "modal") {

            }

            var [w, h, t, l, b, r] = q.position[graph];

            offsetx /= q.pixelRatio;
            offsety /= q.pixelRatio;
            pointw /= q.pixelRatio;
            pointh /= q.pixelRatio;

            var ex = origin == "tr" || origin == "br" ? w - clientx + l - 1 - offsetx : clientx - l - offsetx;
            var ey = origin == "bl" || origin == "br" ? h - clienty + t - 1 - offsety : clienty - t - offsety;

            ex = Math.floor(ex);
            ey = Math.floor(ey);

            Debug.item("getGraphMouse.ex.ey", ex + ", " + ey, "mouse");
            Debug.item("getGraphMouse.scroll", offsetx + ", " + offsety, "mouse");
            Debug.item("point.size", pointw + ", " + pointh, "mouse");
            
            mouse.x = ex;
            mouse.y = ey;

            mouse.col = Math.ceil((ex + 1) / pointw);
            mouse.row = Math.ceil((ey + 1) / pointh);
            mouse.end = colLimit ? loopNumber(mouse.col - 1, colLimit) + 1 : mouse.col;
            mouse.pick = rowLimit ? loopNumber(mouse.row - 1, rowLimit) + 1 : mouse.row;

            // mouse distance from graph edge
            mouse.t = clienty - t;
            mouse.b = b - clienty - 1;
            mouse.l = clientx - l;
            mouse.r = r - clientx - 1;

            mouse.withinGraph = mouse.col > 0 && mouse.row > 0;

        }

        return mouse;

    }

    $(document).on("mousedown", q.ids("weave", "threading", "lifting", "tieup"), async function(e) {

        e.stopPropagation();

        let graph = q.graphId(e.target.id);
        if (q.graph.liftingMode == "liftplan" && graph == "tieup") return;

        let mousex = e.clientX;
        let mousey = e.clientY;
        app.mouse.x = mousex;
        app.mouse.y = mousey;
        app.mouse.down.which = e.which;
        app.mouse.down.graph = graph;

        let mouse = getGraphMouse(graph, mousex, mousey);
        app.mouse.set(graph, mouse.col, mouse.row, true, e.which);

        let drawState = lookup(e.which, [1, 3], [1, 0], undefined);

        // Undefined Mouse Key
        if (e.which == undefined) {
            return false;

            // Mouse outside graph
        } else if (!mouse.withinGraph) {
            Selection.clear();
            return false;

            // Middle Mouse Key
        } else if (e.which == 2) {
            app.contextMenu.tools.obj.showContextMenu(mousex, mousey);
            return false;

            // Right Mouse Key
        } else if (e.which == 3) {

            if (q.graph.tool == "pointer") {
                app.contextMenu.weave.obj.showContextMenu(mousex, mousey);
                return false;

            } else if (q.graph.tool == "selection") {
                Selection.clearIfNotCompleted();
                app.contextMenu.selection.obj.showContextMenu(mousex, mousey);
                return false;

            }

        }

        // if left or right mouse click

        if (q.graph.tool == "selection") {
            if (!Selection.inProgress) Selection.setActive(graph);
            let selectionMouse = getGraphMouse(Selection.graph, mousex, mousey);
            Selection.onMouseDown(Selection.graph, selectionMouse.col - 1, selectionMouse.row - 1);
            if (Selection.grabbed) {

            } else {
                app.selection.postAction(Selection.graph, mouse.col, mouse.row);

            }
            setCursor();

        } else if (q.graph.tool == "pointer") {

            if (graph == "weave" && q.graph.liftingMode == "treadling" && gp.lockTreadling && gp.lockThreading) {
                let shaftNum = q.graph.threading1D[mouse.end - 1];
                let treadleNum = q.graph.treadling1D[mouse.pick - 1];
                if (shaftNum !== undefined && shaftNum && treadleNum !== undefined && treadleNum) {
                    q.graph.set(6, "tieup", "toggle", {
                        col: treadleNum,
                        row: shaftNum
                    });
                }

            } else if (graph == "weave" && q.graph.liftingMode == "liftplan" && gp.lockThreading) {
                let shaftNum = q.graph.threading1D[mouse.end - 1];
                if (shaftNum !== undefined && shaftNum) {
                    q.graph.set(6, "lifting", "toggle", {
                        col: shaftNum,
                        row: mouse.pick
                    });
                }

            } else if (graph == "weave") {
                q.graph.set(6, "weave", "toggle", {
                    col: mouse.end,
                    row: mouse.pick
                });

            } else if (graph && graph.in("threading", "lifting", "tieup")) {
                q.graph.set(6, graph, "toggle", {
                    col: mouse.col,
                    row: mouse.row
                });
            }

        } else if (q.graph.tool == "zoom") {
            let zoomAmount = e.which == 3 ? -1 : 1;
            q.graph.zoomAt(mouse.x + q.graph.scroll.x, mouse.y + q.graph.scroll.y, zoomAmount);

        } else if (q.graph.tool == "hand") {
            grabGraph(graph, e.pageX, e.pageY);

        } else if (q.graph.tool == "brush") {
            graphDraw.shape = "brush";
            graphDraw.onMouseDown();

        } else if (q.graph.tool == "fill") {
            let arr2D8 = await array2D8FloodFill(q.graph.weave2D8, mouse.end - 1, mouse.pick - 1, drawState, gp.seamlessWeave, gp.seamlessWeave);
            q.graph.set(0, "weave", arr2D8);

        } else if (q.graph.tool == "line") {
            graphDraw.shape = "line";
            graphDraw.onMouseDown();

        }

    });

    function grabGraph(graph, grabX, grabY) {

        setCursor("grab");
        app.handGrabbed = true;
        app.handTarget = graph;
        app.handsx = grabX;
        app.handsy = grabY;

        if (graph.in("weave", "warp", "threading")) {
            app.handscrollx = q.graph.scroll.x;
        } else if (graph.in("tieup", "lifting")) {
            app.handscrollx = q.tieup.scroll.x;
        }

        if (graph.in("weave", "weft", "lifting")) {
            app.handscrolly = q.graph.scroll.y;
        } else if (graph.in("tieup", "threading")) {
            app.handscrolly = q.tieup.scroll.y;
        }

    }

    function grabMoveGraph(mousex, mousey) {

        var graphScrolls = {};
        var tieupScrolls = {};

        if (app.handTarget.in("weave", "warp", "threading")) {
            graphScrolls.x = app.handscrollx + mousex - app.handsx;
            
        } else if (app.handTarget.in("tieup", "lifting")) {
            tieupScrolls.x = app.handscrollx + mousex - app.handsx;
        }

        if (app.handTarget.in("weave", "weft", "lifting")) {
            graphScrolls.y = app.handscrolly - mousey + app.handsy;

        } else if (app.handTarget.in("tieup", "threading")) {
            tieupScrolls.y = app.handscrolly - mousey + app.handsy;
        }

        q.graph.scroll.setPos(graphScrolls);
        q.tieup.scroll.setPos(tieupScrolls);

    }

    function documentEventsInit() {

        // document.mouseup
        $(document).mouseup(function(e) {

            if (!q.user.authenticated) return;

            let mousex = e.clientX;
            let mousey = e.clientY;
            app.mouse.x = mousex;
            app.mouse.y = mousey;

            app.mouse.isUp = true;

            Scrollbars.release();
            Pulse.clear("dragPulse");

            app.tieupResizeStart = false;

            var mouseButton = e.which;

            if (mouseButton == 1 || mouseButton == 3) {

                var graph = q.graphId(e.target.id);

                graphDraw.onMouseUp();

                if (app.patternPaint) {
                    let activeSet = app.patternCopy.activeSet;
                    app.history.off();
                    q.pattern.removeBlank(activeSet);
                    app.history.on();
                    if (gp.lockWarpToWeft) {
                        app.history.record("onPatternPaint", "warp", "weft");
                    } else {
                        app.history.record("onPatternPaint", activeSet);
                    }
                    app.patternPaint = false;
                    app.patternCopy = false;
                    q.pattern.updateStatusbar();
                }

                if (q.graph.tool == "fill" && app.action == "patternFill") {
                    app.history.off();
                    q.pattern.removeBlank(app.patternCopy.activeSet);
                    app.history.on();
                    if (gp.lockWarpToWeft) {
                        app.history.record("onFillStripe", app.patternCopy.activeSet, app.patternCopy.otherSet);
                    } else {
                        app.history.record("onFillStripe", app.patternCopy.activeSet);
                    }
                    app.patternCopy = false;
                }

                if (q.graph.tool == "selection") {
                    var selectionMouse = getGraphMouse(Selection.graph, mousex, mousey);
                    if (!selectionMouse.withinGraph) return;
                    Selection.onMouseUp(selectionMouse.col - 1, selectionMouse.row - 1);
                    app.selection.postAction(Selection.graph, selectionMouse.col, selectionMouse.row);
                }

                app.action = false;

                app.handGrabbed = false;
                setCursor();

            }

        });
    }

    function getGraphProp(graph, prop) {

        var value;
        let graphs = ["weave", "threading", "lifting", "tieup", "warp", "weft"];
        let gs = q.graph.scroll;
        let ts = q.tieup.scroll;

        if (prop == "pointW") {
            value = lookup(graph, graphs, [gs.point.w, gs.point.w, gs.point.w, gs.point.w], 1);
        } else if (prop == "pointH") {
            value = lookup(graph, graphs, [gs.point.h, gs.point.h, gs.point.h, gs.point.h], 1);
        } else if (prop == "scrollX") {
            value = lookup(graph, graphs, [gs.x, gs.x, ts.x, ts.x, gs.x, 0], 0);
        } else if (prop == "scrollY") {
            value = lookup(graph, graphs, [gs.y, ts.y, gs.y, ts.y, 0, gs.y], 0);
        } else if (prop == "maxScrollX") {
            value = lookup(graph, graphs, [gs.max.x, gs.max.x, ts.max.x, ts.max.x, gs.max.x, 0]);
        } else if (prop == "maxScrollY") {
            value = lookup(graph, graphs, [gs.max.y, ts.max.y, gs.max.y, ts.max.y, 0, gs.max.y]);
        }

        return value;

    }

    function scrollTowards(graph, directions, amount) {

        var xDirections = directions.replace(/[tb]/g, '');
        var yDirections = directions.replace(/[lr]/g, '');

        if (graph == "weave") {
            q.graph.scrollTowards(directions, Math.round(amount));

        } else if (graph == "tieup") {
            q.tieup.scrollTowards(directions, Math.round(amount));

        } else if (graph == "threading") {
            q.graph.scrollTowards(xDirections, Math.round(amount));
            q.tieup.scrollTowards(yDirections, Math.round(amount));

        } else if (graph == "lifting") {
            q.graph.scrollTowards(yDirections, Math.round(amount));
            q.tieup.scrollTowards(xDirections, Math.round(amount));

        } else if (graph == "warp") {
            q.graph.scrollTowards(xDirections, Math.round(amount));

        } else if (graph == "weft") {
            q.graph.scrollTowards(yDirections, Math.round(amount));

        }

    }

    function autoEdgeScroll() {
        if (!app.doAutoEdgeScroll) return;
        let ppg = getGraphProp(Selection.graph, "pointW");
        scrollTowards(Selection.graph, app.scrollPulseDirection, ppg);
        let dragPulseMouse = getGraphMouse(Selection.graph, app.mouse.x, app.mouse.y);
        Selection.onMouseMove(Selection.graph, dragPulseMouse.col - 1, dragPulseMouse.row - 1);
        Selection.crosshair(Selection.graph, dragPulseMouse.col - 1, dragPulseMouse.row - 1);
    }

    $(document).mousemove(function(e) {

        let mousex = e.clientX;
        let mousey = e.clientY;
        app.mouse.x = mousex;
        app.mouse.y = mousey;

        if (q.tieup.resizing()) return;

        MouseTip.follow(e);
        Scrollbars.drag(e);

        let graph = q.graphId(e.target.id);
        let mouse = getGraphMouse(graph, mousex, mousey);

        Debug.item("graphID", graph);
        Debug.item("target", e.target.id || "-");
        Debug.item("mousex", mousex);
        Debug.item("mousey", mousey);

        if (graph) {
            app.mouse.graph = graph;
            Selection.crosshair(graph, mouse.col - 1, mouse.row - 1);
        }

        let mousePointChanged = mouse.col !== app.mouse.prevCol || mouse.row !== app.mouse.prevRow;
        app.mouse.prevCol = mouse.col;
        app.mouse.prevRow = mouse.row;

        if (graph && graph.in("weave", "threading", "lifting", "tieup") && mousePointChanged) {
            MouseTip.text(0, mouse.col + ", " + mouse.row);

        } else if (graph && graph == "simulation" && mousePointChanged) {
            MouseTip.text(0, mouse.x + ", " + mouse.y);

        } else if (graph && graph == "artwork" && mousePointChanged) {
            MouseTip.text(0, mouse.col + ", " + mouse.row);
            let pci = q.artwork.pointColorIndex(mouse);
            if (isSet(pci)) {
                MouseTip.text(1, pci);
            } else {
                MouseTip.remove(1);
            }

        }

        if (q.graph.tool == "selection") {

            if (Selection.pasting || Selection.stamping) {
                Selection.setActive(Selection.graph);
            }

            let selectionMouse = getGraphMouse(Selection.graph, mousex, mousey);

            Debug.item("graph.edge.distance", selectionMouse.l + ", " + selectionMouse.t + ", " + selectionMouse.r + ", " + selectionMouse.b);

            app.scrollPulseDirection = "";
            let selectionScrollX = getGraphProp(Selection.graph, "scrollX");
            let selectionScrollY = getGraphProp(Selection.graph, "scrollY");
            let selectionMaxScrollX = getGraphProp(Selection.graph, "maxScrollX");
            let selectionMaxScrollY = getGraphProp(Selection.graph, "maxScrollY");
            if (selectionMouse.l < 16 && selectionScrollX < 0) app.scrollPulseDirection += "l";
            if (selectionMouse.t < 16 && selectionScrollY > selectionMaxScrollY) app.scrollPulseDirection += "t";
            if (selectionMouse.r < 16 && selectionScrollX > selectionMaxScrollX) app.scrollPulseDirection += "r";
            if (selectionMouse.b < 16 && selectionScrollY < 0) app.scrollPulseDirection += "b";

            let dragPulse = (Selection.inProgress || Selection.grabbed || Selection.pasting || Selection.filling) && app.scrollPulseDirection.length;

            app.doAutoEdgeScroll = dragPulse;

            // if ( dragPulse ){

            // 	let dragAcceleration = 2;

            // 	new Pulse("dragPulse", true, function(pulseCounter){
            // 		let dragPulseMouse = getGraphMouse(Selection.graph, app.mouse.x, app.mouse.y);
            // 		scrollTowards(Selection.graph, app.scrollPulseDirection, pulseCounter * dragAcceleration )
            // 		Selection.onMouseMove(graph, dragPulseMouse.col-1, dragPulseMouse.row-1);
            //              });

            // } else {

            // 	Pulse.clear("dragPulse");

            // }

            Selection.onMouseMove(Selection.graph, selectionMouse.col - 1, selectionMouse.row - 1);

            setCursor();

        } else if (q.graph.tool == "hand" && app.handGrabbed) {
            grabMoveGraph(mousex, mousey);

        }

        graphDraw.onMouseMove();

        // Patterns --------
        if (q.graph.tool.in("pointer", "brush") && (graph && graph.in("warp", "weft") || app.patternPaint)) {

            var pasteMethod;

            var yarnSet = app.patternPaint ? app.patternCopy.activeSet : graph;

            var isWarp = yarnSet == "warp";
            var isWeft = yarnSet == "weft";

            var pattern = q.pattern[yarnSet];
            var seamless = isWarp ? gp.seamlessWarp : gp.seamlessWeft;

            var colNum = mouse.col;
            var rowNum = mouse.row;
            var endNum = mouse.end;
            var pickNum = mouse.pick;

            var rowColNum = isWarp ? colNum : rowNum;
            var threadNum = loopNumber(rowColNum - 1, q.pattern[yarnSet].length) + 1;
            var seamlessThreadNum = seamless ? threadNum : rowColNum;

            var threadTitle = isWarp ? "Ends" : "Pick";

            globalStatusbar.set("patternThread", threadTitle, seamlessThreadNum);

            if (app.patternPaint) {

                var patternStartNum = app.patternPaintStartNum;
                var pasteW = Math.abs(rowColNum - patternStartNum) + 1;
                var pasteIndex = rowColNum <= patternStartNum ? rowColNum - 1 : rowColNum - pasteW;

                if (pasteIndex < 0) {
                    pasteW += pasteIndex;
                    pasteIndex = 0;
                }

                Debug.item("pasteIndex", pasteIndex);
                Debug.item("pasteW", pasteW);

                var code = q.palette.selected;
                var pasteArr = [code].repeat(pasteW);

                if (seamless) {
                    pasteMethod = "loop";
                } else if (!seamless && code == "0") {
                    pasteMethod = "trim";
                } else if (!seamless && code !== "0") {
                    pasteMethod = "extend";
                }

                app.history.off();

                var newPattern = paste1D(pasteArr, app.patternCopy.active, pasteIndex, pasteMethod, "a");
                Debug.item("newPattern", newPattern);
                q.pattern.set(43, yarnSet, newPattern);

                if (gp.lockWarpToWeft) {
                    var otherYarnSet = yarnSet == "warp" ? "weft" : "warp";
                    q.pattern.set(43, otherYarnSet, newPattern);
                }

                app.history.on();

            }

            var colorCode = false;
            var stripeSize = 0;
            if (pattern[seamlessThreadNum - 1] !== undefined) {
                colorCode = pattern[seamlessThreadNum - 1];
                stripeSize = getStripeData(pattern, seamlessThreadNum - 1)[2];
                $(".palette-chip").removeClass('palette-chip-hover');
                $("#palette-chip-" + colorCode).addClass('palette-chip-hover');
            }

            if (colorCode) {
                MouseTip.text(0, rowColNum + " (" + stripeSize + colorCode + ")");
            } else {
                MouseTip.text(0, rowColNum);
            }

        }

        // Tieup --------
        if (graph == "tieup") {

        }

        // Threading --------
        if (graph == "threading") {

        }

        // Lifting --------
        if (graph == "lifting") {

        }

        // Artwork --------

        // if ( app.views.active == "artwork" ){
        // 	globalStatusbar.set("artworkIntersection", "-", "-");
        // 	globalStatusbar.set("artworkColor", "-", "-");
        // }

        if (graph == "artwork") {
            var aX = ap.seamlessX ? mouse.end - 1 : mouse.col - 1;
            var aY = ap.seamlessY ? mouse.pick - 1 : mouse.row - 1;
            [aX, aY] = isBetween(aX, 0, q.artwork.width - 1) && isBetween(aY, 0, q.artwork.height - 1) ? [aX, aY] : ["-", "-"];

            if (!isNaN(aX) && !isNaN(aY)) {
                var colorIndex = q.artwork.artwork2D8[aX][aY];
                var colorHex = q.artwork.palette[colorIndex].hex;
                globalStatusbar.set("artworkColor", colorHex, colorIndex);

            } else {
                globalStatusbar.set("artworkColor", "-", "-");
            }
        }

        // Simulation --------
        if (graph == "simulation") {

        }

        // Three --------
        if (graph == "three") {
            if (app.mouse.isUp) {
                q.three.doMouseInteraction("mousemove", 0, mouse);
            }
        }

        // Model --------
        if (graph == "model") {
            q.model.doMouseInteraction("mousemove", 0, mouse);
        }

        app.mouse.handleClickWaiting();

    });

    function getAngleDeg(yDis, xDis) {
        var angleDeg = Math.round(Math.atan(yDis / xDis) * 180 / Math.PI);
        return (angleDeg);
    }

    function getCoordinatesOfStraightLastPoint(x0, y0, x1, y1) {
        let xDiff = x1 - x0;
        let yDiff = y1 - y0;
        let xDir = xDiff < 0 ? -1 : 1;
        let yDir = yDiff < 0 ? -1 : 1;
        let min = Math.min(Math.abs(xDiff), Math.abs(yDiff));
        let ratio = Math.round(Math.abs(xDiff) / Math.abs(yDiff));
        let angle = Math.round(getAngleDeg(Math.abs(yDiff), Math.abs(xDiff)));
        let rx1 = x0;
        let ry1 = y0;
        if (angle > 66) {
            ry1 += Math.abs(yDiff) * yDir;
        } else if (angle < 23) {
            rx1 += Math.abs(xDiff) * xDir;
        } else {
            rx1 += min * xDir;
            ry1 += min * yDir;
        }
        return [rx1, ry1];
    }

    // ----------------------------------------------------------------------------------
    // Web Worker
    // ----------------------------------------------------------------------------------
    var fileSaveWorker = new Worker("js/file-save-worker.js");
    fileSaveWorker.onmessage = function(e) {
        //saveCanvasAsImage(g_tempCanvas, weaveFileName+".png");
    };

    // ----------------------------------------------------------------------------------
    // Weave Analysis Web Worker
    // ----------------------------------------------------------------------------------
    var graphWorker = new Worker('js/worker.graph.js');
    var graphPromiseWorker = new PromiseWorker(graphWorker);

    // ----------------------------------------------------------------------------------
    // Artwork Analysis & Process Web Worker
    // ----------------------------------------------------------------------------------
    var artworkWorker = new Worker('js/worker.artwork.js');
    var artworkPromiseWorker = new PromiseWorker(artworkWorker);

    // ----------------------------------------------------------------------------------
    // Simulation Web Worker
    // ----------------------------------------------------------------------------------
    var resolves;
    var rejects;
    var simulationWorker = new Worker('js/worker.simulation.js');
    simulationWorker.onmessage = function(oEvent) {
        console.log(["onmessage", oEvent.data]);
        resolves(oEvent.data);
    };

    function simulationWorkerPromise(data, transferables) {
        return new Promise((resolve, reject) => {
            simulationWorker.postMessage(data, transferables);
            resolves = resolve;
            rejects = reject;
        });
    }

    // ----------------------------------------------------------------------------------
    // Keyborad Shortcuts
    // ----------------------------------------------------------------------------------
    hotkeys("*", {
        keydown: true,
        keyup: true

    }, function(e, handler) {

        let key = e.key;
        let code = e.keyCode ? e.keyCode : e.charCode;
        let type = e.type;
        let isPressed =

            Debug.item("Keyborad", key + " " + type + " " + code);

        if (!app.allowKeyboardShortcuts) {
            app.contextMenu.palette.obj.hideContextMenu();
            app.contextMenu.selection.obj.hideContextMenu();
            app.contextMenu.weave.obj.hideContextMenu();
            app.contextMenu.pattern.obj.hideContextMenu();
            app.contextMenu.tools.obj.hideContextMenu();
            return false;
        }

        // Keyboard shortcuts for GRAPH
        if (app.views.active == "graph") {

            let controlDown = (hotkeys.ctrl || hotkeys.command || hotkeys.control) && type == "keydown";
            let shiftDown = hotkeys.shift && type == "keydown";
            let shiftUp = hotkeys.shift && type == "keyup";
            let enterDown = key == "Enter" && type == "keydown";
            let escapeDown = key == "Escape" && type == "keydown";
            let isSelection = q.graph.tool == "selection";

            // If no special key is pressed
            if (!controlDown && !shiftDown) {
                if (key == "p") q.graph.tool = "pointer";
                else if (key == "b") q.graph.tool = "brush";
                else if (key == "h") q.graph.tool = "hand";
                else if (key == "z") q.graph.tool = "zoom";
                else if (key == "l") q.graph.tool = "line";
                else if (key == "f") q.graph.tool = "fill";
                else if (key == "s") q.graph.tool = "selection";

                // If control key is pressed
            } else if (controlDown && !shiftDown) {
                if (key == "r") console.log("prevent.page.refresh");
                else if (key == "z") app.history.undo();
                else if (key == "y") app.history.redo();
                else if (key == "a" && isSelection) app.selection.selectAll();
                else if (key == "c" && isSelection) app.selection.copy();
                else if (key == "x" && isSelection) app.selection.cut();
                else if (key == "v" && isSelection) app.selection.startPaste(app.mouse.graph);

                // If shift key is pressed
            } else if (!controlDown && shiftDown) {
                if (q.graph.tool == "line") {
                    graphDraw.straight = true;
                    graphDraw.render();
                }

                // If shift key is up
            } else if (!controlDown && shiftUp) {
                if (q.graph.tool == "line") {
                    graphDraw.straight = false;
                    graphDraw.render();
                }

            } else if (!controlDown && enterDown) {
                if (q.graph.tool == "line") {
                    graphDraw.commitPoints();
                }

            }

            if (escapeDown) {
                q.palette.clearMarker();

                if (q.graph.tool.in("line", "brush")) {
                    graphDraw.reset();
                }

                if (app.patternPaint) {
                    app.history.off();
                    q.pattern.set(122, "warp", app.patternCopy.warp);
                    q.pattern.set(122, "weft", app.patternCopy.weft);
                    app.history.on();
                    app.patternPaint = false;
                    app.patternCopy = false;
                    app.mouse.reset();

                }

                Selection.cancel();
                setCursor();
                app.contextMenu.hide();

                if (app.colorPicker.popup.isVisible() || app.anglePicker.popup.isVisible()) {
                    app.colorPicker.popup.hide();
                    app.anglePicker.popup.hide();
                    return;
                }
                app.popups.hide();
                XWin.hideAll("modal");

            }

            if (Selection.inProgress && shiftDown) {
                Selection.square = true;
            } else {
                Selection.square = false;
            }

            if (Selection.isCompleted && shiftDown && !shiftUp && type == "keydown") {
                if (key == "ArrowLeft") Selection.resize("width", -1);
                else if (key == "ArrowUp") Selection.resize("height", 1);
                else if (key == "ArrowRight") Selection.resize("width", 1);
                else if (key == "ArrowDown") Selection.resize("height", -1);

            } else if (Selection.isCompleted && !shiftDown && !shiftUp && type == "keydown") {
                if (key == "ArrowLeft") Selection.shift("left");
                else if (key == "ArrowUp") Selection.shift("up");
                else if (key == "ArrowRight") Selection.shift("right");
                else if (key == "ArrowDown") Selection.shift("down");

            }

        }

        return false;

    });

    // ----------------------------------------------------------------------------------
    // Application Runtime
    // ----------------------------------------------------------------------------------
    Selection.pixelRatio = q.pixelRatio;
    new Selection("weave", q.limits.maxWeaveSize, q.limits.maxWeaveSize);
    new Selection("threading", q.limits.maxWeaveSize, q.limits.maxShafts);
    new Selection("lifting", q.limits.maxShafts, q.limits.maxWeaveSize);
    new Selection("tieup", q.limits.maxShafts, q.limits.maxShafts);
    new Selection("warp", q.limits.maxWeaveSize, 1);
    new Selection("weft", 1, q.limits.maxWeaveSize);
    new Selection("artwork", q.limits.maxArtworkSize, q.limits.maxArtworkSize);
    new MouseTip();

    // ----------------------------------------------------------------------------------
    // DHMLX
    // ----------------------------------------------------------------------------------
    var layoutData = {
        parent: document.body,
        pattern: "1C",
        cells: [{
            id: "a",
            text: "Tabbar",
            header: false
        }],
        offsets: {
            top: -1,
            right: -1,
            bottom: -1,
            left: -1
        }
    };

    // app.layout = new dhtmlXLayoutObject(layoutData);
    // app.layout.attachFooter("statusbar-frame");

    // ----------------------------------------------------------------------------------
    // Debug Window
    // ----------------------------------------------------------------------------------
    new Debug(dhxWins);

    XForm.app = app;
    XForm.q = q;
    XWin.app = app;
    XWin.q = q;
    XWin.layout = app.layout;
    XWin.dhxWins = dhxWins;

    q.user = globalUser;
    q.palette = globalPalette;
    q.graph = globalGraph;
    q.pattern = globalPattern;
    q.artwork = globalArtwork;
    q.simulation = globalSimulation;
    q.three = globalThree;
    q.model = globalModel;
    q.tieup = globalTieup;
    q.position = globalPosition;

    var gp = q.graph.params;
    var ap = q.artwork.params;
    var sp = q.simulation.params;
    var tp = q.three.params;
    var mp = q.model.params;
    var _p = q.simulation.profiles;

    console.log("app.ui.load:start");
    app.ui.load();

});

// ----------------------------------------------------------------------------------
// Window Unload
// ----------------------------------------------------------------------------------
$(window).on("unload", function() {
    if (dhxWins !== null && dhxWins.unload !== null) {
        dhxWins.unload();
        dhxWins = null;
    }
});

// $(window).bind('mousewheel DOMMouseScroll', function (event) {
// 	if (event.ctrlKey == true) {
// 		event.preventDefault();
// 	}
// });

/* Alert Leaving Website after first click. Even Refresh
$(window).bind("beforeunload", function() {
	return "Reloading or closing the page will reset settings and all data will be lost.";
});
*/

// Disable back an forward navigation. Refresh works. No Prompt
history.pushState(null, null, document.URL);
window.addEventListener("popstate", function() {
    history.pushState(null, null, document.URL);
});