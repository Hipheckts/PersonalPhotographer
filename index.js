'use strict';

const express = require('express');
const bodyParser = require('body-parser');
var http = require("http");
var pngjs = require("pngjs");
var v4l2camera = require("v4l2camera");

//For Caption Service.
const captionService = require('./caption-service'),
    needle = require("needle"),
    restify = require('restify'),
    url = require('url'),
    validUrl = require('valid-url'),
    PNG = require('pngjs').PNG;

var gcloud = require('google-cloud');
var storage = gcloud.storage;
var storage = require('@google-cloud/storage');
var fs = require("fs");

var Vision = require('@google-cloud/vision');

// Instantiate a vision client
var vision = Vision({
  projectId: 'personal-photographer',
  keyFilename: './personal-photographer-1887ee02d70c.json'
});

// Authenticating on a per-API-basis. You don't need to do this if you auth on a
// global basis (see Authentication section above).

var gcs = storage({
  projectId: 'personal-photographer',
  keyFilename: './personal-photographer-833f66686fbd.json'
});

// Reference an existing bucket.
var bucket = gcs.bucket('photoassist-bucket');


var watson = require('watson-developer-cloud');
var visual_recognition = watson.visual_recognition({
  headers: {
    "X-Watson-Learning-Opt-Out": "1"
  },
  api_key: '97ae832e5433a7c726763ef1187891619fae4819',
  version: 'v3',
  version_date: '2016-05-19'
});

const restService = express();
restService.use(bodyParser.json());


function printFaces(faces){
    if(faces && faces.length){
        console.log("Age and Gender of this face: " + "Age: " + faces[0].age + " Gender: "+ faces[0].gender);
    }
}

restService.post('/', function (req, res) {

    console.log('webhook request from API.AI');

    try {
        var speech = 'empty speech';

        if (req.body) {
            var requestBody = req.body;

            if (requestBody.result) {
                speech = '';

                if (requestBody.result.fulfillment) {
                    speech += requestBody.result.fulfillment.speech;
                    speech += ' ';
                }

                if (requestBody.result.action === 'TakePicture') {
                    var png = toPng();
                    var resultImage = 'result' + Date.now() + '.png';
                    // Write the result to a file
                    //png.pack().pipe(fs.createWriteStream(resultImage));
                    fs.writeFileSync(resultImage, pngjs.PNG.sync.write(png.pack()));
                    speech = 'Picture taken and... ';
                    console.log('picture saved');
                    // Upload a local file to a new file to be created in your bucket.
                    /*bucket.upload(resultImage, function(err, file) {
                        if (!err) {
                             console.log(resultImage + " is now in your bucket.");
                            }else {
                                console.log("Error uploading to  bucket." + err);
                            }
                      });*/     

                    vision.detectFaces(resultImage, function (err, faces, response) {
                    if (err) {
                        console.log("Error in vision.detectFaces." + err );
                    }else {
                        var numFaces = faces.length;
                        console.log('Found ' + numFaces + (numFaces === 1 ? ' face' : ' faces'));
                        
                        faces.forEach(function (face) {
                            console.log(null, face);
                            if(face.joy)
                                speech += ' you look happy';
                            else if(face.sorrow)
                                speech +=  ' you look sad';
                            else if(face.anger)
                                speech += ' you look angry';
                            else if(face.surpise)
                                speech += ' you look surprised';
                            else 
                                speech += ' I can not read your mood';

                        });
                         console.log('result: ', speech);

                        /*
                        // MS API: Read Stream for Captions  
                        fs.createReadStream(resultImage)
                            .pipe(new PNG())
                            .on('parsed', function() {
                                captionService.getCaptionFromStream(this.pack())
                                    .then(caption => console.log("This picture says this about you... " + caption))
                                    .catch(error => console.error(error));
                        });


                        // Read Stream for FACES
                        fs.createReadStream(resultImage)
                            .pipe(new PNG())
                            .on('parsed', function() {                               
                                captionService.getFacesFromStream(this.pack())
                                    .then(faces => printFaces(faces))
                                    .catch(error => console.error(error));
                        });
                        */
                        //MS API:  Read Stream for EMOTIONS
                        /* This image size is too big it seems for MS
                        fs.createReadStream(resultImage)
                            .pipe(new PNG())
                            .on('parsed', function() {                               
                                captionService.getEMOTIONSFromStream(this.pack())
                                    .then(emotions => console.log(null, emotions))
                                    .catch(error => console.error(error));
                        });
                        
                        captionService.getEMOTIONSFromUrl('https://tse3.mm.bing.net/th?id=OIP.M9cfa7362b791260dbfbfbb2a5810a01eo2&pid=Api')
                                    .then(emotions => console.log(null,emotions[0].scores))
                                  .catch(error => console.error(error));
                        */
                        var params = {
                            classifier_ids: [
                                "uyyala_family_331440013"
                            ],
                            images_file: fs.createReadStream(resultImage),
                        };

                        visual_recognition.classify(params, function(err, resp) {
                            if (err) {
                                console.log(err);
                            }
                            else {
                                console.log("Response: " + JSON.stringify(resp, null, 2));

                                if(resp && resp.images.length && resp.images[0].classifiers.length){
                                    speech += ', ' + resp.images[0].classifiers[0].classes[0].class;
                                }

                          
                                console.log('result: ', speech);
                                return res.json({
                                    speech: speech,
                                    displayText: speech,
                                    source: 'apiai-webhook-sample'
                            });

                            } 
                           
                                
                        });


                       
                    }});
                }
            }
        }


       
    } catch (err) {
        console.error("Can't process request", err);
        
        return res.status(400).json({
            status: {
                code: 400,
                errorType: err.message
            }
        });
    }
});

restService.get('/', function(req, res){
  console.log('http get request from browser');
   try {

     if (req.url === "/") {
        res.writeHead(200, {
            "content-type": "text/html;charset=utf-8",
        });
        res.end([
            "<!doctype html>",
            "<html><head><meta charset='utf-8'/>",
            "<script>(", script.toString(), ")()</script>",
            "</head><body>",
            "<img id='cam' width='352' height='288' />",
            "</body></html>",
        ].join(""));
        return;
    }

    } catch (err) {
        console.error("Can't process request", err);

        return res.status(400).json({
            status: {
                code: 400,
                errorType: err.message
            }
        });
    }
  });

// For all other requests
restService.use(function(req, res, next){

    if (req.url.match(/^\/.+\.png$/)) {
        res.writeHead(200, {
            "content-type": "image/png",
            "cache-control": "no-cache",
        });
        var png = toPng();
        return png.pack().pipe(res);
    }

    next();
});


restService.listen((process.env.PORT || 5000), function () {
    console.log("Server listening");
});

var script = function () {
    window.addEventListener("load", function (ev) {
        var cam = document.getElementById("cam");
        (function load() {
            var img = new Image();
            img.addEventListener("load", function loaded(ev) {
                cam.parentNode.replaceChild(img, cam);
                img.id = "cam";
                cam = img;
                load();
            }, false);
            img.src = "/" + Date.now() + ".png";
            console.log("In script: " + img.src);
        })();
    }, false);
};

var toPng = function () {
    var rgb = cam.toRGB();
    var png = new pngjs.PNG({
        width: cam.width, height: cam.height,
        deflateLevel: 1, deflateStrategy: 1,
    });
    var size = cam.width * cam.height;
    for (var i = 0; i < size; i++) {
        png.data[i * 4 + 0] = rgb[i * 3 + 0];
        png.data[i * 4 + 1] = rgb[i * 3 + 1];
        png.data[i * 4 + 2] = rgb[i * 3 + 2];
        png.data[i * 4 + 3] = 255;
    }
    return png;
};

var cam = new v4l2camera.Camera("/dev/video0")
if (cam.configGet().formatName !== "YUYV") {
    console.log("YUYV camera required");
    process.exit(1);
}
cam.configSet({width: 352, height: 288});
cam.start();
cam.capture(function loop(){
    cam.capture(loop);
});
