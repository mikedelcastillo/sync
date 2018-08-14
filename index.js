const recursive = require('readdir-enhanced');
const fs = require('fs-extra');
const path = require('path');
const equals = require('object-equal');
const watch = require('recursive-watch');
const del = require('del');

const cwd = process.cwd();

const log = (type, message) => {
  console.log(new Date(), type, message);
}

const getFiles = dir => new Promise((resolve, reject) => {
  recursive(dir, { deep: true }, (err, files) => {
    if(err) return reject(err);
    resolve(files
    .filter(file => fs.existsSync(path.join(dir, file)))
    .map(file => {
      try{
        file = path.join(dir, file)
        const stats = fs.statSync(file);
        const isDir = fs.lstatSync(file).isDirectory();
        const obj = {
          file: path.relative(dir, file),
          size: stats.size,
          // created: stats.ctime.toString(),
          // added: stats.atime.toString(),
          modified: isDir ? 0 : stats.mtime.toString(),
          type: !isDir ? 'file' : 'dir',
        };

        return obj;
      } catch(e){
        return null;
      }
    }));
  });
});


const sync = (from, to) => new Promise(async (resolve, reject) => {
  try{
    let fromFiles = await getFiles(from);
    let toFiles = await getFiles(to);

    const filesToWrite = [];
    const filesToDelete = [];

    const dirsToMake = [];
    const dirsToDelete = [];

    for(let fromFile of fromFiles){
      let fromFound;
      let toFound;

      for(let toFile of toFiles){
        if(fromFile.file == toFile.file){
          fromFound = fromFile;
          toFound = toFile;
          break;
        }
      }

      if(!fromFound || !equals(fromFound, toFound)){
        //copy it
        filesToWrite.push(fromFile);
      }

    }

    for(let toFile of toFiles){
      let fromFound;
      let toFound;

      for(let fromFile of fromFiles){
        if(fromFile.file == toFile.file){
          fromFound = fromFile.file;
          toFound = toFile.file;
          break;
        }
      }

      if(!fromFound){
        filesToDelete.push(toFile);
      }
    }


    for(let file of filesToWrite){
      let fromFile = path.join(from, file.file);
      let toFile = path.join(to, file.file);

      log('COPYING', fromFile);
      if(fs.existsSync(toFile)){
        del.sync([toFile], { force: true });
      }
      fs.copySync(fromFile, toFile);
    }

    for(let file of filesToDelete){
      let toFile = path.join(to, file.file);

      log('DELETING', toFile);
      del.sync([toFile], { force: true });
    }

    resolve();
  } catch(e){
    reject(e);
    return null;
  }
});

let syncs = 1;

const syncLoop = async (from, to) => {
  log('SYNCING', syncs);
  if(syncs > 0){
    try{
      await sync(from, to);
      syncs = Math.max(0, syncs - 1);
      log('SYNCED', syncs);
    } catch(e){
      syncs++;
    }
    syncLoop(from, to);
  } else if(syncs == 0){
    log('IDLE', syncs);
  } else{
    syncs = 0;
  }
};

if(process.argv.length > 2){
  const from = process.argv[2];
  const to = process.argv[3];

  setInterval(() => {
    syncs++;
    syncLoop(from, to);
  }, 10000);
  watch(from, function (filename) {
    syncs++;
    if(syncs == 1) syncLoop(from, to);
  });
}
