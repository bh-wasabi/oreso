var fs = require('fs');
var https = require('https')
var async = require('async');
var moment = require('moment');
var _ = require('underscore');
var XLSX = require('xlsx');
var nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1]);
var Utils = require('../make/js/utils').Utils;
var docSystem = require('../make/js/genDocumentSystem');
var codeSystem = require('../make/js/genCodeSystem');
var makeSql = require('../make/js/makeSql');
var makeCfg = require('../make/js/makeCfg');
//var MD5 = require('md5');
//var replaceExt = require('replace-ext');
var params = '';
var subProyect;
// const { decisionTable } = require('js-feel')();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
// process.env.UV_THREADPOOL_SIZE = 512;

var decisionTable;
if (nodeVersion<7){
  decisionTable = require('js-feel').decisionTable;
} else {
  // a partir de la version 1.3.1 funciona asi, y esta version se instala cuando es un node mas reciente
  decisionTable = require('js-feel')().decisionTable;
}

var makeToken = "58c41f52-6fcb-43c2-82a0-760b435d344a";

// host
var wasabiHost = 'demo.enlanube.io'
wasabiHost = 'oreso.enlanube.io'
//wasabiHost = 'cinetop.enlanube.io'

// ssh -i "dev-cinetop.pem" ec2-user@cinetop.enlanube.io
// ssh -i "oreso.pem" ec2-user@oreso.enlanube.io

var logo = 'https://s3.amazonaws.com/mx-imagenes/logos/grupo-oreso.png';
var logo3 = 'https://s3.amazonaws.com/mx-imagenes/logos/grupo-oreso.png';
var headers = ['Grupo Oreso', 'Leibnitz 83-1','Anzures 11590 CDMX','Teléfono +52 (55) 5580 6118']
params = '&esOreso=true';
subProyect = 'oreso';

// var logo = 'https://s3.amazonaws.com/mx-imagenes/logos/cinetop.png';
// var logo3 = 'https://s3.amazonaws.com/mx-imagenes/logos/cinetop.png';
// var headers = ['Xtra Cinemas', 'Reforma 215','Lomas de Chapultepec 11000 CDMX','Teléfono 55 5284 8500']
// params = '&esCinetop=true';
// subProyect = 'cinetop';


var logo2;

var proyectId = 'oreso';
var filename = proyectId+'-metadata.xlsx';

if (filename&&filename.substr(-1)=='.'){
  filename+='xlsx'
}
// elasticsearch
var esHost = 'http://demo5.enlanube.io:3000/es'

var forceList = [];
var ignoreList = [];

var getFileExt = function(filename){
  return filename && filename.split('.').pop();
}

var renameFileExt = function(fileName, newExt){
  if (fileName && newExt){
    return fileName.substr(0, fileName.lastIndexOf('.')) + '.'+newExt;
  }
}

var getFileName = function(filename){
  return filename && filename.replace(/^.*[\\\/]/, '');
}

// var getConfig = function(filename){
//   var out = {};
//   var buf = fs.readFileSync(filename);
//   var wb = XLSX.read(buf, {type:'buffer'});
//   var sheets = wb.SheetNames;    
//   _.each(sheets, function(sheet){
//     out[sheet] = Utils.trimKeys(XLSX.utils.sheet_to_json(wb.Sheets[sheet], {raw: true, defval:null}))
//   })
//   var old = '';
//   var newFile = replaceExt(filename, '.cfg');
//   if (fs.existsSync(newFile)){
//     old = fs.readFileSync(newFile, 'utf8');
//   }
//   var data = JSON.stringify(out);
//   if (MD5(old)!==MD5(data)){
//     fs.writeFileSync(newFile, data);
//     console.log("upload config...", newFile);
//     return data;
//   }
// }


var makeOne = function(path, filename, callback){
  if (path.substr(0,5)==='auto/'){
    path = 'auto';
  } else if (path.substr(0,6)==='merge/'){
    path = 'merge';
  }
  var name = getFileName(filename);
  if (name.indexOf('.')>0 && name.substr(0,2)!=='~$'){
    var ext = getFileExt(filename);
    var data;
    if (ext==='hbs'||ext==='auto'){
      if (fs.existsSync(filename)){
        data = fs.readFileSync(filename);
      }      
    } else
    // if (path==='config'){
    //   if (ext==='xlsx'){
    //     data = getConfig(filename);  
    //     if (data){
    //       filename = replaceExt(filename, '.cfg');
    //       forceList.push(filename);
    //     }
    //   }      
    // } else
    if (path&&ext==='bpmn'){
      data = fs.readFileSync(filename);
    } else
    if (path&&(ext==='xls'||ext==='xlsx')){
      data = decisionTable.xls_to_csv(filename)[0];
      filename = renameFileExt(filename, 'dmn');
    }
    if (data){
      if (path==='auto'||path==='merge'/*||path==='config'*/){
        name = getFileName(filename);
        if (ignoreList.indexOf(name.split('.')[0])<0){
          name = path+'/'+name;  
        } else name = '';
      } else {
        name = getFileName(filename);
        if (ext==='hbs'){
          ignoreList.push(name.split('.')[0]);
        }
        // si es un hbs simpre hay que forzarlo
      }
      if (name){
        var url = '/hbs/make/demo?filename='+name+params+'&force='+(forceList.indexOf(name)>=0);
        if (makeToken){
          url+='&makeToken='+makeToken;
        }
        var req = https.request({ 
          host: wasabiHost, 
          port: 443,
          path: url,
          method: 'POST',
          timeout: 360000,
        }, function(res){
          if (path==='auto' && res.statusCode==200){
            var hbsName = 'merge/'+name.slice(5).split('.')[0]+'.hbs';
            forceList.push(hbsName);
            // console.log(forceList)
          }
          if (res.statusCode!=201){
            console.log('make...', res.statusCode, filename)  
          }        
          callback(res.statusCode);
        }).on('error', function(err){
          err && console.error('request', err);
        });
        req.write(data);
        req.end();
      } else callback();
    } else callback();
  } else callback();
}

var doRestart = function(){
  var req = https.request({ 
    host: wasabiHost, 
    port: 443,
    path: '/hbs/restart',
    method: 'GET',
    timeout: 360000,
  }, function(err){
  });
  req.end();
}

var makePath = function(path, callback){
  var restart;
  fs.readdir('./'+path, function(err, files){
    // creo que no tiene que ir en serie en este punto
    // async.eachSeries(files, function(file, callback) {

    var fn = (wasabiHost==='demo.enlanube.io')?'eachSeries':'each';
    //fn = 'eachSeries';
    //console.log(fn, path+'...')
    async[fn](files, function(file, callback) {
      if (path){
        file = path+'/'+file;
      }
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()){ //&& path.substr(0,3)==='hbs'){
          makePath(file, function(err, res) {
            callback();
          })
        } else {
          // console.log(file)
          makeOne(path, file, function(statusCode){
            if (statusCode==202){
              restart = true;
            }
            callback();
          })          
        }
      })
    }, function(err){
      callback(restart);
    })
  })
}

var genAuto = function(proyectId, callback){
  // callback();
  if (proyectId){
    var paso1 = moment();
    var buf = fs.readFileSync(filename);
    var wb = XLSX.read(buf, {type:'buffer'});
    codeSystem.generate(wb, proyectId, filename, subProyect, esHost+'/'+proyectId, function(err, codeSystem){
      console.log('codeSystem...', moment().diff(paso1)+'ms')
      docSystem.generate(wb, proyectId, filename, subProyect, logo3, headers, codeSystem, {imageWidth: 75}, function(err){
        console.log('hbs generated...', moment().diff(paso1)+'ms')
        console.log(proyectId+'.es generated...')
        callback(null, codeSystem);
      })
    })
  } else callback();
}

console.log('host', wasabiHost)
// if (filename){
//   makeOne('auto', 'auto/auto_'+filename, function(){
//     makeOne('', filename, function(){
//       // restart();
//     })
//   })
// } else {
    // process.exit();

// makeSql.make('sql', proyectId, 'install/'+proyectId+'-01-base.sql', function(){
//   makeCfg.make('rules', proyectId, 'install/'+proyectId+'-02-rules.sql', function(){
//     makeCfg.make('config', proyectId, 'install/'+proyectId+'-03-cfg.sql', function(){  
      genAuto(proyectId, function(err, codeSystem){
        makePath('hbs', function(){
          makePath('auto', function(){      
            // makePath('bpmn', function(){
              // makePath('dmn', function(restart){
                makePath('merge', function(){
                  // if (restart){
                  //   console.log('restart in 1/2 second...')
                  //   setTimeout(function(){doRestart();}, 150);
                  // }
                });
              // });
            // });
          });
        });
      });
//     });
//   })  
// })
