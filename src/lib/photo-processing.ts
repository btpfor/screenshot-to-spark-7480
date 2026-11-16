import wasm from "@/assets/photo-ai/vision-wasm.asset.json";
export type Crop={x:number;y:number;width:number;height:number};
export function identityCrop(box:{originX:number;originY:number;width:number;height:number},width:number,height:number,ratio=35/45):Crop {
 const h=Math.min(height,box.height*2.8,width/ratio),w=h*ratio;
 return {x:Math.max(0,Math.min(width-w,box.originX+box.width/2-w/2)),y:Math.max(0,Math.min(height-h,box.originY-box.height*.45)),width:w,height:h};
}
export async function processPortrait(file:File,progress:(s:string)=>void,ratio=35/45) {
 progress("Analyse de la photographie");
 const image=await createImageBitmap(file);
 const canvas=document.createElement("canvas");
 const scale=Math.min(1,1600/Math.max(image.width,image.height));canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
 const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Traitement photo indisponible");ctx.drawImage(image,0,0,canvas.width,canvas.height);image.close();
 const {FaceDetector,ImageSegmenter}=await import("@mediapipe/tasks-vision");
 const wasmUrl=new URL(wasm.url,"https://screenshot-to-spark-7480.lovable.app").href;
 const files={wasmLoaderPath:"/photo-ai/wasm/vision_wasm_internal.js",wasmBinaryPath:wasmUrl};
 progress("Détection du visage");
 const face=await FaceDetector.createFromOptions(files,{baseOptions:{modelAssetPath:"/photo-ai/face.tflite"},runningMode:"IMAGE",minDetectionConfidence:.5});
 let box;
 try {const detected=face.detect(canvas).detections;if(detected.length!==1)throw new Error("Choisissez une photo avec un seul visage, de face et bien éclairé.");box=detected[0]?.boundingBox;}finally{face.close();}
 if(!box)throw new Error("Visage non détecté. Vous pouvez conserver la photo originale.");
 progress("Suppression de l’arrière-plan");
 const segmenter=await ImageSegmenter.createFromOptions(files,{baseOptions:{modelAssetPath:"/photo-ai/portrait.tflite"},runningMode:"IMAGE",outputConfidenceMasks:true,outputCategoryMask:false});
 try {
 segmenter.segment(canvas,(result)=>{
  const mask=result.confidenceMasks?.[0];if(!mask)throw new Error("Arrière-plan non détecté");
  const values=mask.getAsFloat32Array();const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
   const i=(y*canvas.width+x)*4;const confidence=values[Math.min(mask.height-1,Math.floor(y*mask.height/canvas.height))*mask.width+Math.min(mask.width-1,Math.floor(x*mask.width/canvas.width))]??0;
   const alpha=Math.max(0,Math.min(1,(confidence-.2)/.6));
   for(let c=0;c<3;c++)pixels.data[i+c]=Math.round((pixels.data[i+c]??0)*alpha+255*(1-alpha));pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);
 });
 }finally{segmenter.close();}
 progress("Ajustement du cadrage");
 return {canvas,crop:identityCrop(box,canvas.width,canvas.height,ratio)};
}
export async function cropPortrait(canvas:HTMLCanvasElement,crop:Crop,ratio=35/45):Promise<Blob> {
 const out=document.createElement("canvas");out.width=700;out.height=Math.round(700/ratio);const ctx=out.getContext("2d");if(!ctx)throw new Error("Export indisponible");
 ctx.drawImage(canvas,crop.x,crop.y,crop.width,crop.height,0,0,out.width,out.height);
 return new Promise((resolve,reject)=>out.toBlob(blob=>blob?resolve(blob):reject(new Error("Export photo impossible")),"image/jpeg",.94));
}