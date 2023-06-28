class customPlayer extends Player {
   /**
    * @param {Object} param  { div_id: Canvas的父元素(DIV) ID , canvas_name : Canvas的ID}
    */
   constructor(param) {
      super()
      //獲取div
      this.div = document.getElementById(param.div_id);
      //創建canvas
      this.canvas = document.getElementById(param.canvas_name);
      //取得context
      this.ctx = this.canvas.getContext('2d');
      // 與div大小的縮放比例
      this.scaleModifier = 0.9;
      this.setSize();
      // 設定 物件繪製，發射目標 馬達追蹤
      this.objFilter = ['car', 'person', 'truck'];
      this.tracking = false;
      /**主要執行 當 decode()完成後 會執行 onPictureDecoded() -> renderFrame() -> onRenderFrameComplete() --↓
       *                               ↑----------------------------------------------------------------←
       * @param {Object} obj 
       * obj={
            data: buffer,
            width: width,
            height: height,
            infos: infos,
            canvasObj: self.canvasObj
         }
       */
      this.onRenderFrameComplete = (obj) => {
         this.ctx.imageSmoothingEnabled = true;
         //繪製影像
         this.drawImg(this.canvas, this.ctx, obj);
         let scale = this.canvas.width / obj.width;
         //如果有 single Tracking 或 multi Tracking 才進行這個程式 放在 CameraView
         if (this.onImageReady != undefined) {
            this.onImageReady(this.canvas, scale);
         }
         //繪製物件框
         this.drawOsd(this.ctx, scale);

         //如果有設定esp32Control才會進行控制追蹤
         if (this.esp32Control != undefined) {
            if (this.esp32Control.readyState == 1 && this.tracking)
               this.controlEsp(this.esp32Control);
         }

      }
      window.addEventListener('resize', () => {
         this.setSize();
      })
   }
   /**
    * 置中繪製影像 
    * @param {HTMLCanvasElement} canvas
    * @param {CanvasRenderingContext2D} ctx 
    * @param {Object} obj 
    * @param {String} text
    */
   drawImg(canvas, ctx, obj, text = "") {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      //計算圖片與canvas的比例 並將圖片置中
      let ratio = 0, dWidth = 0, dHeight = 0;
      if (canvas.width < canvas.height) {
         ratio = canvas.width / obj.width;
         dWidth = canvas.width
         dHeight = obj.height * ratio;
      } else {
         ratio = canvas.height / obj.height;
         dWidth = obj.width * ratio;
         dHeight = canvas.height;
      }
      //繪製底色
      ctx.beginPath();
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      //繪製圖片
      ctx.drawImage(obj.canvasObj.canvas,
         0, 0, obj.width, obj.height,
         (canvas.width - dWidth) / 2, (canvas.height - dHeight) / 2,
         obj.width * canvas.height / obj.height, canvas.height
      );
      //繪製文字
      ctx.beginPath();
      //繪製陰影
      ctx.font = "32px RocknRoll One";
      ctx.fillStyle = 'blue';
      ctx.fillText(text, 20 + 3, 50 + 3)
      //繪製文字
      ctx.font = "30 RocknRoll One";
      ctx.fillStyle = 'white';
      ctx.fillText(text, 20, 50)
   }
   /**
    * 根據osd.type選擇要繪製的方式
    * @param {CanvasRenderingContext2D} ctx 
    * @param {Number} scale 
    * @returns 
    */
   drawOsd(ctx, scale) {
      if (this.osd == null)
         return;
      switch (this.osd.type) {
         case "osd":
            this.drawRawOsd(ctx, scale);
            break;
         case "object_detection":
            this.drawObjectDetectionOSD(ctx, scale);
            break;
         case "facial_recognition":
            this.drawObjectDetectionOSD(ctx, scale);
            break;
         default: // no osd
            break;
      }
   }
   //實作drawOsd繪製的方式
   /**
    * 將osd.serial作為command對ctx基本設定進行設定
    * @param {CanvasRenderingContext2D} ctx 
    * @param {Number} scale 
    */
   drawRawOsd(ctx, scale) {
      let serial = this.osd.serial;
      for (let i = 0; i < serial.length; i++) {
         let cmd = serial[i];
         switch (cmd.c) {
            case "strokeStyle":
               ctx.strokeStyle = cmd.v;
               break;
            case "lineWidth":
               ctx.lineWidth = cmd.v * scale;
               break;
            case "fillStyle":
               ctx.fillStyle = cmd.v
               break;
            case "fillText":
               ctx.fillText(cmd.v, cmd.x * scale, cmd.y * scale);
               break;
            case "fillRect":
               ctx.fillRect(cmd.x * scale, cmd.y * scale, cmd.w * scale, cmd.h * scale);
               break;
            case "beginPath":
               ctx.beginPath();
               break;
            case "stroke":
               ctx.stroke();
               break;
            case "rect":
               ctx.rect(cmd.x * scale, cmd.y * scale, cmd.w * scale, cmd.h * scale);
               break;
            case "circle":
               ctx.ellipse(cmd.x * scale, cmd.y * scale, cmd.r * scale, cmd.r * scale, 0, 0, 2 * Math.PI);
               break;
            case "fill":
               ctx.fill();
               break;
            case "font":
               ctx.font = cmd.s * scale + "px " + cmd.v;
               break;
            case "globalAlpha":
               ctx.globalAlpha = c.v / 100;
               break;
         }
      }
   }
   /**
    * 將osd.serial作為command對ctx基本設定進行設定
    * @param {CanvasRenderingContext2D} ctx 
    * @param {Number} scale 
    */
   drawObjectDetectionOSD(ctx, scale) {
      let res = this.osd.result;
      if (res.status == "ok") {
         let detection = res.detection;
         // draw box
         // 設定邊框寬度
         ctx.lineWidth = 2 * scale;
         // 設定字體大小與字型
         let fontForm = 15 * scale + "px Arial";
         ctx.font = fontForm;
         //設定顏色
         ctx.strokeStyle = "SpringGreen";

         for (let i = 0; i < detection.length; i++) {
            let od = detection[i];
            // console.log(od);
            let labelName = od.class;
            if (!this.objFilter.includes(labelName))
               continue;
            camView.detecting = true;
            //計算物件寬度
            let bw = od.maxx - od.minx + 1;
            let bh = od.maxy - od.miny + 1;
            //繪製物件框
            // console.log(od.minx , od.maxx , od.miny , od.maxy)
            // console.log(od.minx * scale, od.miny * scale, bw * scale, bh * scale)
            ctx.beginPath();
            ctx.rect(od.minx * scale, od.miny * scale, bw * scale, bh * scale);
            ctx.stroke();

            ctx.fillStyle = "Red";
            ctx.beginPath();
            ctx.arc((od.maxx + od.minx)*scale/2 , (od.maxy + od.miny)*scale/2 , 3, 0, 2 * Math.PI);
            ctx.fill();
            //繪製物件類別
            ctx.strokeStyle = "SpringGreen";
            ctx.beginPath();
            ctx.fillStyle = "SpringGreen";
            ctx.fillText(labelName + " Score:" + (od.score.toFixed(2)), od.minx * scale, (od.miny - 5) * scale);
         }
         //如果有偵測到物體 才能夠啟用 Launch
         camView.toggleLaunch($("#launchBtn"))
         camView.detecting = false;
      }
   }
   /**
    * 設定Canvas 的16:9的長寬
    */
   setSize() {

      let mainDivRect = this.div.getBoundingClientRect()
      if ((Math.floor(mainDivRect.height)) * 16 / 9 * this.scaleModifier < Math.floor(mainDivRect.width)) {
         this.canvas.width = (Math.floor(mainDivRect.height)) * 16 / 9 * this.scaleModifier;
         this.canvas.height = (Math.floor(mainDivRect.height)) * 1 * this.scaleModifier;
      } else {
         this.canvas.width = Math.floor(mainDivRect.width) * 1 * this.scaleModifier;
         this.canvas.height = Math.floor(mainDivRect.width) * 9 / 16 * this.scaleModifier;
      }
      // console.log("setSize", this.canvas.width, ",", this.canvas.height);
   }
   /**
    * 將webSocket收到的Object進行設定
    * @param {Object} osd 
    * {type: 'object_detection', result: {…}}
            result: detection: Array(0)
            length: 0
            [[Prototype]]: Array(0)
            elapsed_time: 102686
            height: 360
            iou: 0.20000000298023224
            model: "yolov4-416-uint8-3"
            score: 0.25
            status: "ok"
            width: 640
            }
    */
   setOsd(osd) {
      this.osd = structuredClone(osd)
   }
   //ESP32 Control ------------------------------------------------------------------
   /**
    * 控制Esp32的函式
    * @param {esp32Servo} esp32Control 
    */
   controlEsp(esp32Control) {
      let res = this.osd.result;
      if (res.status == "ok") {
         let detection = res.detection;
         for (let i = 0; i < detection.length; i++) {
            let od = detection[i];
            let labelName = od.class;
            //如果有在指定的Class才會進行追縱流程
            if (!this.objFilter.includes(labelName))
               continue;
            //如果旋轉還沒完成
            if (!esp32Control.pwmRotateComplete) {
               console.log(`%c馬達旋轉還沒完成`, "background:#ff00ff; color:#ffffff;")
               continue;
            }

            esp32Control.changeTarget(od);
            esp32Control.cameraTrace(this.canvas);
            // console.log("追蹤目標");

         }
      }
   }
   /**
    * 設定 Esp32 若有設定才會進行 函式controlEsp
    * @param {esp32Servo} esp32control 
    */
   setEsp(esp32control) {
      this.esp32Control = esp32control;
   }
}

/**
 * @param {Array} detection Array of Object
 * @returns 
*/
const getUnion = (detection, destCanvas) => {
   let detection_count = detection.length;
   let union = { minx: 0, miny: 0, maxx: 0, maxy: 0 };
   if (detection_count > 0) {
      union.minx = detection[0].minx;
      union.maxx = detection[0].maxx;
      union.miny = detection[0].miny;
      union.maxy = detection[0].maxy;
      for (let i = 1; i < detection_count; i++) {
         if (detection[i].minx < union.minx) {
            union.minx = detection[i].minx;
         }
         if (detection[i].maxx > union.maxx) {
            union.maxx = detection[i].maxx;
         }
         if (detection[i].miny < union.miny) {
            union.miny = detection[i].miny;
         }
         if (detection[i].maxy > union.maxy) {
            union.maxy = detection[i].maxy;
         }
      }
   } else {
      // full screen
      union.minx = 0
      union.maxx = destCanvas.width
      union.miny = 0
      union.maxy = destCanvas.height
   }

   return union;
}
/**
 * 用來增加四周的間距
 * @param {Object} rect 
 * @param {Number} marginW 
 * @param {Number} marginH 
 * @returns 
 */
const addMargin = (rect, marginW, marginH) => {
   let margin_w = (rect.max_x - rect.min_x + 1) * marginW / 2;
   let mergin_h = (rect.max_y - rect.min_y + 1) * marginH / 2;
   rect.min_x -= margin_w;
   rect.min_y -= mergin_h;
   rect.max_x += margin_w;
   rect.max_y += mergin_h;

   return rect;
}
/**
 * 縮小比例
 * @param {Object} rect 
 * @param {Number} scale 
 * @returns 
 */
const rectScale = (rect, scale) => {
   rect.minx *= scale;
   rect.maxx *= scale;
   rect.miny *= scale;
   rect.maxy *= scale;

   return rect;
}
/**
 * 矯正超出邊界的點
 * @param {Object} union 
 * @param {HTMLCanvasElement} output_canvas 
 * @param {HTMLCanvasElement} tracking_canvas 
 * @returns 
 */
const adjustRect = (union, output_canvas, tracking_canvas) => {
   // adjust the bounding box to the canvas size
   // if the object is outside of the canvas, then full screen it
   if (union.minx < 0) union.minx = 0;
   if (union.minx > output_canvas.width) union.minx = 0;
   if (union.miny < 0) union.miny = 0;
   if (union.miny > output_canvas.height) union.miny = 0;
   if (union.maxx >= output_canvas.width) union.maxx = output_canvas.width - 1;
   if (union.maxx < 0) union.maxx = output_canvas.width - 1;
   if (union.maxy >= output_canvas.height) union.maxy = output_canvas.height - 1;
   if (union.maxy < 0) union.maxy = output_canvas.height - 1;
   // keep aspect ratio as the tracking_canvas ratio
   let cx = (union.maxx + union.minx) / 2;
   let cy = (union.maxy + union.miny) / 2;
   let bw = union.maxx - union.minx + 1;
   let bh = union.maxy - union.miny + 1;
   // setup minimal width or height
   if (bw < 60) bw = 60;
   if (bh < 60) bh = 60;
   if (bw / bh > tracking_canvas.width / tracking_canvas.height) {
      bh = bw * tracking_canvas.height / tracking_canvas.width;
      if (bh > tracking_canvas.height) {
         bh = tracking_canvas.height;
         bw = bh * tracking_canvas.width / tracking_canvas.height;
      }
   } else {
      bw = bh * tracking_canvas.width / tracking_canvas.height;
      if (bw > tracking_canvas.width) {
         bw = tracking_canvas.width;
         bh = bw * tracking_canvas.height / tracking_canvas.width;
      }
   }
   // process max, in width or height
   if (bw > output_canvas.width) {
      bw = output_canvas.width;
      bh = bw * tracking_canvas.height / tracking_canvas.width;
   } else if (bh > output_canvas.height) {
      bh = output_canvas.height - 1;
      bw = bh * tracking_canvas.width / tracking_canvas.height;
   }
   // adjust the result to the video canvas size
   let minx = cx - bw / 2;
   let maxx = cx + bw / 2;
   let miny = cy - bh / 2;
   let maxy = cy + bh / 2;
   // shift if necessary, but keep the size
   if (minx < 0) {
      maxx -= minx;
      minx = 0;
   }
   if (miny < 0) {
      maxy -= miny;
      miny = 0;
   }
   if (maxx > output_canvas.width) {
      minx -= (maxx - output_canvas.width);
      maxx = output_canvas.width - 1;
   }
   if (maxy > output_canvas.height) {
      miny -= (maxy - output_canvas.height);
      maxy = output_canvas.height - 1;
   }
   union.minx = minx;
   union.maxx = maxx;
   union.miny = miny;
   union.maxy = maxy;

   return union;
}

const moveCamera = (curRect, minx, miny, maxx, maxy) => {
   let steps = 12; // steps to target
   let accel = 0.12;
   let cx = (minx + maxx) / 2;
   let cy = (miny + maxy) / 2;
   let dx = curRect._cx - cx;
   let dy = curRect._cy - cy;
   if (dx != 0 || dy != 0) {
      let distance = Math.sqrt(dx * dx + dy * dy);
      let linear_speed = distance / steps;
      curRect._speed = curRect._speed + accel;
      if (curRect._speed > linear_speed) {
         curRect._speed = linear_speed;
      }
      // adjust steps count for controlling camera speed
      steps = steps * steps / curRect._speed;
      curRect._cx = (curRect._cx * (steps - 1) + cx) / steps;
      curRect._cy = (curRect._cy * (steps - 1) + cy) / steps;
      curRect._width = (curRect._width * (steps - 1) + (maxx - minx)) / steps;
      curRect._height = (curRect._height * (steps - 1) + (maxy - miny)) / steps;
   }
}

/**
 * 設定Canvas 的16:9的長寬
 */
const setCanvasSize = (div, canvas, scaleModifier) => {

   let divRect = div.getBoundingClientRect()
   if ((Math.floor(divRect.height)) * 16 / 9 * scaleModifier < Math.floor(divRect.width)) {
      canvas.width = (Math.floor(divRect.height)) * 16 / 9 * scaleModifier;
      canvas.height = (Math.floor(divRect.height)) * 1 * scaleModifier;
   } else {
      canvas.width = Math.floor(divRect.width) * 1 * scaleModifier;
      canvas.height = Math.floor(divRect.width) * 9 / 16 * scaleModifier;
   }
   // console.log("setCanvasSize", canvas.width, ",", canvas.height);
}

drawZoomInfo = (output_canvas, tracking_canvas, destCtx, scale) => {
   destCtx.font = 15 * scale + "px Arial";
   destCtx.fillStyle = "rgba(125,255,125,255)";

   let zoom = output_canvas.height / destCtx._height;
   zoom = zoom.toFixed(2);
   destCtx.fillText("ZOOM: " + zoom + "x", 10 * scale, 20 * scale);

   let left = 10 * scale;
   let top = 25 * scale;

   destCtx.globalAlpha = 0.7;
   destCtx.fillStyle = "#000000";
   destCtx.beginPath();
   destCtx.fillRect(left, top, output_canvas.width / 8, output_canvas.height / 8);
   destCtx.fill();

   destCtx.globalAlpha = 1.0;
   destCtx.strokeStyle = "yellow";
   destCtx.lineWidth = 1 * scale;
   destCtx.beginPath();
   destCtx.rect(left + (destCtx._cx - destCtx._width / 2) * scale / 8, top + (destCtx._cy - destCtx._height / 2) * scale / 8, destCtx._width * scale / 8, destCtx._height * scale / 8);
   destCtx.stroke();
}

class CameraView extends WebSocket {
   /**
    * 
    * @param {String} url 
    * @param {customPlayer} videoPlayer 
    * @param {esp32Servo} esp32control
    */
   constructor(url, videoPlayer, esp32control) {
      super(url);
      // console.log("CameraView Created")
      this.binaryType = 'arraybuffer';
      this.bitStream = [];
      this.videoPlayer = videoPlayer;
      this.getModelStatusReady = null;
      this.streaming = false; //是否在直播
      this.detecting = false; //是否有偵測到目標
      this.tracking = false;
      this.launchBtn = document.querySelector("#launchBtn") || undefined
      this.trackBtn = document.querySelector("#trackBtn") || undefined
      this.reloadBtn = document.querySelector("#reloadBtn") || undefined
      this.leftBtn = document.querySelector("#leftBtn") || undefined
      this.rightBtn = document.querySelector("#rightBtn") || undefined
      this.curFeature = getCurrentFeature(); // menu.js 根據 url 取得對應的功能

      if (esp32control == undefined) {
         console.log("沒有找到ESP32");
      }
      this.videoPlayer.setEsp(esp32control);

      $("#trackBtn").click(() => {
         this.toggleTracking($("#trackBtn"));
      })

      $("#streamBtn").click(() => {
         this.toggleStream($("#streamBtn"));
      })

      if (this.launchBtn != undefined) {
         this.launchBtn.addEventListener("click", () => {
            console.log("投擲手榴彈");
            this.Launch_Request();
         })
      }

      if (this.reloadBtn != undefined) {
         this.reloadBtn.addEventListener("click", () => {
            console.log("Reload");
            this.Reload();
         })
      }

      if (this.leftBtn != undefined) {
         this.leftBtn.addEventListener("click", () => {
            this.videoPlayer.esp32Control.turnLeft();
         })
      }
      if (this.rightBtn != undefined) {
         this.rightBtn.addEventListener("click", () => {
            this.videoPlayer.esp32Control.turnRight();
         })
      }


      this.onopen = () => {
         console.log("連接上 Hub8735");
         this.getVersion();
         this.toggleStream($("#streamBtn"));
         switch (this.curFeature) {
            case "Object Detection":
               //改變模式
               this.videoPlayer.mode = "object_detection";
               this.stopModel(["yolo4t", "retinaface", "mobilenetface", "yamnet"]);
               this.startModel(["yolo4t"]);
               // this.startModel(["yolo4t", "object_tracking"]);
               break;

            case "Audio Detection":
               this.stopModel(["yolo4t", "retinaface", "mobilenetface", "yamnet"]);
               this.startModel(["yamnet"]);
               break;

            case "Single Tracking":
               this.videoPlayer.mode = "single_tracking";
               this.stopModel(["yolo4t", "retinaface", "mobilenetface", "yamnet"]);
               this.startModel(["yolo4t", "object_tracking"]);
               this.videoPlayer.onImageReady = this.drawSingleTracking;

               break;

            case "Multi Tracking":
               this.videoPlayer.mode = "multi_tracking";
               this.stopModel(["yolo4t", "retinaface", "mobilenetface", "yamnet"]);
               this.startModel(["yolo4t", "object_tracking"]);
               this.videoPlayer.onImageReady = this.drawMultiTracking;
               break;

            default:
               break;
         }
      }

      this.onmessage = (evt) => {
         //收到影像資料         
         if (evt.data instanceof ArrayBuffer) {
            //儲存影像資料在陣列中
            this.bitStream.push(evt.data);
            //當影像資料足夠時，再進行解碼
            while (this.bitStream.length > 5) {
               let data = this.bitStream.shift();
               this.videoPlayer.decode(new Uint8Array(data));
            }
         } else {
            //對其他資料進行解析            
            /*
            {type: 'object_detection', result: {…}}
            result: detection: Array(0)
            length: 0
            [[Prototype]]: Array(0)
            elapsed_time: 102686
            height: 360
            iou: 0.20000000298023224
            model: "yolov4-416-uint8-3"
            score: 0.25
            status: "ok"
            width: 640
            }
            */
            var obj = JSON.parse(evt.data);
            switch (obj.type) {
               case "get_model_status":
                  if (this.getModelStatusReady != null) {
                     this.getModelStatusReady(obj.result.value);
                     this.getModelStatusReady = null;
                  }
                  break;
               case "reg_face":
                  break;
               case "get_reg_face":
                  break;
               case "get_version":
                  var vs = "";
                  var value = obj.result.value;
                  for (var i = 0; i < value.length; i++) {
                     vs = vs + value[i];
                  }
                  this.firmwareVersion = vs;
                  break;
               default:
                  this.videoPlayer.setOsd(obj);
                  break;
            }
         }
      }

      this.onclose = () => {
         // console.log('Disconnected from Websocket Server.')
      }
      this.onerror = (evt) => {
         // console.log("Connection Error");
      }

      if (this.curFeature == "Single Tracking") {
         // 調整大小 
         setCanvasSize(document.getElementById("mainDiv"), document.getElementById("obj_canvas0"), 0.9)
         window.addEventListener("resize", () => {
            setCanvasSize(document.getElementById("mainDiv"), document.getElementById("obj_canvas0"), 0.9)
         })
      }
   }

   drawSingleTracking(output_canvas, scale) {
      if (this.osd.result.status == "ok") {
         let res = this.osd.result;
         let detection = res.detection;

         // draw tracking result
         let id_name = 'obj_canvas0';
         let tracking_canvas = document.getElementById(id_name);
         let destCtx = tracking_canvas.getContext('2d');

         // union the tracking
         let union = getUnion(detection, destCtx);
         union = addMargin(union, 1.1, 2.0);
         union = rectScale(union, scale);
         union = adjustRect(union, output_canvas, tracking_canvas);
         //移動馬達         


         if (typeof destCtx._cx == "undefined") {
            destCtx._cx = (union.minx + union.maxx) / 2;
            destCtx._cy = (union.miny + union.maxy) / 2;
            destCtx._width = union.maxx - union.minx + 1;
            destCtx._height = union.maxy - union.miny + 1;
            destCtx._speed = 0;
         } else {
            moveCamera(destCtx, union.minx, union.miny, union.maxx, union.maxy);
         }
         destCtx.globalAlpha = 1.0;
         // draw image from "output_canvas" to "tracking_canvas"
         destCtx.drawImage(output_canvas, destCtx._cx - destCtx._width / 2, destCtx._cy - destCtx._height / 2, destCtx._width, destCtx._height, 0, 0, tracking_canvas.width, tracking_canvas.height);
         drawZoomInfo(output_canvas, tracking_canvas, destCtx, scale)
      }
   }

   drawMultiTracking(output_canvas, scale) {
      if (this.osd.result.status == "ok") {
         let res = this.osd.result;
         let detection = res.detection;
         let detection_count = detection.length;

         // filter tracking classes
         let classes = [];
         for (let i = 0; i < detection_count; i++) {
            if (detection[i].class == 'person') {
               classes.push(detection[i]);
            }
         }
         detection = classes; // filtered
         detection_count = classes.length;
         let painted = [false, false, false, false];
         if (detection_count > 4) {
            detection_count = 4; // TODO: make a better purge
         }
         for (let i = 0; i < detection_count; i++) {
            let cidx = -1; // initial
            // if there is already a person in the same position, replace it
            for (let j = 0; j < 4; j++) {
               if (this.slotInfo[j].oid == detection[i].oid) {
                  cidx = j;
                  break;
               }
            }
            if (cidx < 0) {
               if (this.idMap.has(detection[i].oid)) {
                  let count = this.idMap.get(detection[i].oid);
                  if (count < 20) {
                     this.idMap.set(detection[i].oid, count + 1);
                     continue;
                  }
               } else {
                  this.idMap.set(detection[i].oid, 0);
                  continue
               }
            }
            if (cidx < 0) { // not found, get new one position
               for (let j = 0; j < 4; j++) {
                  if (this.slotInfo[j].oid < 0) {
                     this.slotInfo[j] = { oid: detection[i].oid, time: new Date().getTime() };
                     cidx = j;
                     break;
                  }
               }
            }
            if (cidx < 0) { // no new position, remove one with minimal time
               let min_time = this.slotInfo[0].time;
               cidx = 0;
               for (let j = 1; j < 4; j++) {
                  if (this.slotInfo[j].time < min_time) {
                     min_time = this.slotInfo[j].time;
                     cidx = j;
                  }
               }
            }
            if (cidx >= 0) {
               this.slotInfo[cidx].time = new Date().getTime();
               this.slotInfo[cidx].oid = detection[i].oid;
               painted[cidx] = true;
            }

            let id_name = 'obj_canvas' + cidx;
            let tracking_canvas = document.getElementById(id_name);
            let destCtx = tracking_canvas.getContext('2d');
            let od = structuredClone(detection[i]);
            od = rectScale(od, scale);
            od = addMargin(od, 1.1, 2.0);
            od = adjustRect(od, output_canvas, tracking_canvas);
            if (typeof destCtx._cx == "undefined") {
               destCtx._cx = (od.minx + od.maxx) / 2;
               destCtx._cy = (od.miny + od.maxy) / 2;
               destCtx._width = od.maxx - od.minx + 1;
               destCtx._height = od.maxy - od.miny + 1;
               destCtx._speed = 0;
            } else {
               moveCamera(destCtx, od.minx, od.miny, od.maxx, od.maxy);
            }
            // draw image from "output_canvas" to "tracking_canvas"
            destCtx.drawImage(output_canvas, destCtx._cx - destCtx._width / 2, destCtx._cy - destCtx._height / 2, destCtx._width, destCtx._height, 0, 0, tracking_canvas.width, tracking_canvas.height);
            drawZoomInfo(output_canvas, tracking_canvas, destCtx, scale)
         }
         // after loop, process those unpaint slots
         // clear zoom screen
         for (let i = 0; i < 4; i++) {
            if (!painted[i]) {
               let id_name = 'obj_canvas' + i;
               let tracking_canvas = document.getElementById(id_name);
               let destCtx = tracking_canvas.getContext('2d');
               let minx = (output_canvas.width - output_canvas.height) / 2; // TODO: fix this for landscape
               let miny = 0;
               let maxx = output_canvas.width - minx - 1;
               let maxy = output_canvas.height - 1;
               if (typeof destCtx._cx == "undefined") {
                  destCtx._cx = (minx + maxx) / 2;
                  destCtx._cy = (miny + maxy) / 2;
                  destCtx._width = maxx - minx + 1;
                  destCtx._height = maxy - miny + 1;
                  destCtx._speed = 0;
               } else {
                  moveCamera(destCtx, minx, miny, maxx, maxy);
               }
               destCtx.drawImage(output_canvas, destCtx._cx - destCtx._width / 2, destCtx._cy - destCtx._height / 2, destCtx._width, destCtx._height, 0, 0, tracking_canvas.width, tracking_canvas.height);
               drawZoomInfo(output_canvas, tracking_canvas, destCtx, scale)
               destCtx.globalAlpha = 0.7;
               destCtx.beginPath();
               destCtx.fillStyle = "#000000";
               destCtx.fillRect(0, 0, tracking_canvas.width, tracking_canvas.height);
               destCtx.fill();
               destCtx.globalAlpha = 1.0;
            }
         }
      }
   }

   startStream(btn) {
      if (btn != undefined) {
         btn.removeClass("btn-primary").addClass("btn-danger");
         btn.html('停止直播');
      }
      this.send(JSON.stringify({ cmd: "start_stream" }));
      this.streaming = true;
   }

   stopStream(btn) {
      if (btn != undefined) {
         btn.removeClass("btn-danger").addClass("btn-primary");
         btn.html('開始直播');
      }
      this.send(JSON.stringify({ cmd: "stop_stream" }));
      this.streaming = false;
   }
   //啟用或者禁用直播按鈕
   toggleStream(btn) {
      if (!this.streaming) {
         this.startStream(btn);
      } else {
         this.stopStream(btn);
      }
   }

   getModelStatus(ready) {
      if (ready == undefined) {
         ready = null;
      }
      this.getModelStatusReady = ready;
      this.send(JSON.stringify({ cmd: "get_model_status" }));
   }

   startModel(models) {
      this.send(JSON.stringify({ cmd: "start_model", param: models }));
   }

   stopModel(models) {
      this.send(JSON.stringify({ cmd: "stop_model", param: models }));
   }

   getVersion() {
      this.send(JSON.stringify({ cmd: "get_version" }));
   }

   enableLaunch(btn) {
      if (btn != undefined) {
         btn.disabled = false;
         btn.removeClass("disable");
         btn.html('吃芭樂');
      }
   }

   disableLaunch(btn) {
      if (btn != undefined) {
         btn.disabled = true;
         btn.addClass("disable");
         btn.html('偵查中');
      }
   }
   //啟用或者禁用發射按鈕
   toggleLaunch(btn) {
      // console.log("執行toggle Launch" , this.detecting)
      if (this.detecting) {
         this.enableLaunch(btn);
      } else {
         this.disableLaunch(btn);
      }
   }

   startTracking(btn) {
      if (btn != undefined) {
         btn.removeClass("btn-primary").addClass("btn-danger");
         btn.html('停止追蹤');
      }
      this.tracking = true;
      this.videoPlayer.tracking = true;
   }

   stopTracking(btn) {
      if (btn != undefined) {
         btn.removeClass("btn-danger").addClass("btn-primary");
         btn.html('開始追蹤');
      }
      this.tracking = false;
      this.videoPlayer.tracking = false;
   }
   //啟用或者禁用直播按鈕
   toggleTracking(btn) {
      if (!this.tracking) {
         this.startTracking(btn);
      } else {
         this.stopTracking(btn);
      }
   }


   Launch_Request() {
      var url = 'http://192.168.1.100/rotate?deg=10';
      fetch(url)
         .then(response => response.text())
         .then(data => console.log())
         .catch(error => console.error());
   }

   Reload() {
      // var url = 'http://192.168.1.100/rotate?deg=120';
      // fetch(url)
      //    .then(response => response.text())
      //    .then(data => console.log())
      //    .catch(error => console.error());
      this.videoPlayer.esp32Control.resetTo90();
   }
}

/**
 * 用來連接 ESP32以此進行 對ESP32傳遞JSON 來旋轉伺服馬達
 */
class esp32Servo extends WebSocket {
   /**    
    * @param {String} url ESP32 Websockets的 ip
    */
   constructor(url) {
      super(url);
      this.verValue = 1484;//垂直 Servo pwm值
      this.horValue = 1484;//水平 Servo pwm值
      this.basePwm = 3; // 基礎旋轉
      this.proportion = [0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0] //(目標位置-畫面中心)/畫面寬度 所佔用的畫面比例
      this.powerX = [50, 40, 30, 20, 15, 10, 3] //當超過畫面比例時 要乘以的垂直 Servo power
      this.powerY = [50, 40, 30, 20, 15, 10, 3] //當超過畫面比例時 要乘以的水平 Servo power
      this.ignoreDeviationRatio = 0.04; //在一定的畫面 pixel中 停止轉動

      this.kp = 0.8;
      this.lastKi = 0;
      this.ki = 0.1;
      this.lastDx = 0;
      this.kd = 0.5;
      this.deltaTime = 0.2;

      this.curTarget = { //當前目標的物件
         minx: 0,
         maxx: 0,
         miny: 0,
         maxy: 0,
         cx: 0,
         cy: 0
      }

      this.pwmRotateComplete = true;
      this.degRotateComplete = true;

      this.onopen = () => {
         console.log('連接上ESP32 準備Servo控制');
      }

      this.onclose = function () {
         console.log("Disconnect from ESP");
      };

      this.onerror = function (error) {
         console.error('ESP32連線出錯:', error);
      };

      this.onmessage = (event) => {
         console.log("收到ESP消息", event.data);
         if (event.data == "pwm_Completed") {
            this.pwmRotateComplete = true;
            console.log(`%cPWM旋轉完成`, "background:#00bb00;color:#222;");
         }
         if (event.data == "deg_Completed") {
            this.degRotateComplete = true;
            console.log(`%cDEG旋轉完成`, "background:#00bb00;color:#222;");
         }

      }
   }
   /**
    * 建立一個JSON用來傳送給ESP32
    * @param {String} type [rotate]
    * @param {String} info [pwm , deg]
    * @param {Number} value1 垂直數值 pwm range(566 , 2383) , deg range(1 , 177)
    * @param {Number} value2 水平數值 pwm range(566 , 2383) , deg range(1 , 177)
    * @returns 
    */
   createJson(type, info, value1, value2) {
      var data = {
         type: type,
         info: info,
         value1: value1,
         value2: value2
      }
      var json = JSON.stringify(data);
      return json;
   }
   /**
    * 用來傳送PWM Rotate
    * @param {Number} value_v 垂直數值 pwm range(566 , 2383)
    * @param {Number} value_h 水平數值 pwm range(566 , 2383)
    */
   sendRotateJson(value_v, value_h) {
      console.log(`%c傳送的pwm: 水平:${value_h} , 垂直:${value_v}`, "font-size: 20px;");
      // let jsonToSend = this.createJson("rotate", "pwm", value_v, value_h);
      let jsonToSend = this.createJson("rotate", "pwm", 1484, value_h);
      //傳送pwm給Esp32
      this.send(jsonToSend);
      this.pwmRotateComplete = false;
   }
   /**
    * 用來更改ESP32當前追蹤的目標
    * @param {Object} target {minx , maxx , miny , maxy}
    */
   changeTarget(target) {
      this.curTarget.minx = target.minx;
      this.curTarget.maxx = target.maxx;
      this.curTarget.miny = target.miny;
      this.curTarget.maxy = target.maxy;
      this.curTarget.cx = (this.curTarget.minx + this.curTarget.maxx) / 2;
      this.curTarget.cy = (this.curTarget.miny + this.curTarget.maxy) / 2;
   }
   /**
    * 追蹤目標的P算法 
    * @param {HTMLCanvasElement} canvas 進行追蹤的畫面 會依據這個畫面的比例進行pwm計算
    */
   cameraTrace(canvas) {
      let cx = canvas.width / 2;
      let cy = canvas.height / 2;

      let dx = this.curTarget.cx - cx;// dx > 0 目標在右邊
      let dy = this.curTarget.cy - cy;// dx < 0 目標在左邊
      //獲得正負值
      let signX = Math.sign(dx);
      let signY = Math.sign(dy);

      //如果與目標的差距小於50 則不進行追蹤 curStep = 0代表可以更換主目標
      // 雙軸Servo
      // if (Math.abs(dx) < this.ignoreDeviationRatio && Math.abs(dy) < this.ignoreDeviationRatio) {
      //    this.curStep = 0;
      //    return;
      // }
      // 水平Servo only
      console.log(`%c ${Math.abs(dx)} , ${canvas.width} ,  ${canvas.width * this.ignoreDeviationRatio} ` , "font-size: 20px; color: #fff; background: #de1f18;")
      if (Math.abs(dx) < canvas.width * this.ignoreDeviationRatio) {
         console.log(`%c>>小於誤差值 停止移動<<${Math.abs(dx)}`, "font-size: 20px; color: #fff; background: #de1f18;")
         return;
      }

      //計算速度1
      let vx = Math.abs(this.kp * dx + this.ki * (dx * this.deltaTime + this.lastKi) + this.kd * (dx - this.lastDx) * this.deltaTime);
      this.lastKi = this.ki * (dx * this.deltaTime + this.lastKi);
      this.lastDx = dx;
      let vy = Math.abs(dy)
      console.log(`%c P : ${this.kp * dx + this.ki} , I: ${this.ki * (dx * this.deltaTime + this.lastKi)} , D: ${this.kd * (dx - this.lastDx) * this.deltaTime}`, "font-size: 20px; color: #fff; background: #de1f18;");
      //計算速度2 最終速度為 min(速度1,速度2);      
      for (let i = 0; i < this.proportion.length; i++) {
         if (Math.abs(dx) / canvas.width > this.proportion[i]) {
            console.log(`速度2 比例${this.proportion[i]} , 力道${this.powerX[i]}`)
            vx = Math.min(vx, this.basePwm * this.powerX[i]);
            break;
         }
      }
      for (let j = 0; j < this.proportion.length; j++) {
         if (Math.abs(dy) / canvas.height > this.proportion[j]) {
            // console.log("vy", this.basePwm, this.powerY[j])
            vy = Math.min(vy, this.basePwm * this.powerY[j]);
            break;
         }
      }
      //將 vx , vy 變為整數
      vx = Math.floor(vx);
      vy = Math.floor(vy);

      if (signX > 0)
         console.log(`%c>>目標在右邊，與目標的差距: dx:${dx} , dy:${dy} 最終速度: vx:${vx} , vy:${vy}`, "font-size: 20px; color: #fff; background: #2332b8;");
      else
         console.log(`%c<<目標在左邊，與目標的差距: dx:${dx} , dy:${dy} 最終速度: vx:${vx} , vy:${vy}`, "font-size: 20px; color: #222; background: #42a832;");

      this.verValue += vy * signY;
      this.horValue -= vx * signX;
      console.log(`%c最終Value: vx:${this.horValue} , vy:${this.verValue}`, "font-size:20px;");
      this.sendRotateJson(this.verValue, this.horValue);
   }
   /**
    * 重製Servo 到 90度 , 90度
    */
   resetTo90() {
      if (!this.degRotateComplete)
         return console.log("馬達還沒完成旋轉");
      let jsonToSend = this.createJson("rotate", "deg", 90, 90);
      this.horValue = 1484;
      this.verValue = 1484;
      this.send(jsonToSend);
      this.degRotateComplete = false;
   }
   /**
    * 移動畫面向左 pwm變更量: 100
    */
   turnLeft() {
      if (!this.pwmRotateComplete)
         return console.log("馬達還沒完成旋轉");
      this.horValue += 100;

      console.log("turn Left", this.horValue);
      this.sendRotateJson(this.verValue, this.horValue)
   }
   /**
    * 移動畫面向右 pwm變更量: 100
    */
   turnRight() {
      if (!this.pwmRotateComplete)
         return console.log("馬達還沒完成旋轉");
      this.horValue -= 100;

      console.log("turn Right", this.horValue);
      this.sendRotateJson(this.verValue, this.horValue)
   }
}

//主程式
const initialize = () => {

   let player = new customPlayer({ div_id: "mainDiv", canvas_name: "mainView" })
   let epsControl = new esp32Servo("ws://192.168.1.100:81/");
   let addr = "ws://" + "192.168.1.1" + ":8081";
   camView = new CameraView(addr, player, epsControl);

   window.setInterval(() => {
      if (epsControl.readyState == 0 || epsControl.readyState == 2 /* CLOSING */ || epsControl.readyState == 3 /* CLOSED */) {
         console.log("重新連線 ESP32");
         epsControl = new esp32Servo("ws://192.168.1.100:81/");
      }
      if (epsControl.readyState == 1) {
         if (camView.readyState == 2 /* CLOSING */ || camView.readyState == 3 /* CLOSED */) {
            console.log("reconnect !!");
            camView = new CameraView(addr, player, epsControl);
         }
      }

   }, 1000);
}

window.addEventListener("load", initialize)

