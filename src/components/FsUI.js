import React, { PureComponent } from 'react'
import {connect} from 'react-redux'
import { withStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import DialogActions from '@material-ui/core/DialogActions'
import Icon from '@mdi/react'
import IconButton from '@material-ui/core/IconButton'
import InputBase from '@material-ui/core/InputBase'
import Paper from '@material-ui/core/Paper'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableContainer from '@material-ui/core/TableContainer'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import TextField from '@material-ui/core/TextField'
import Toolbar from '@material-ui/core/Toolbar'
import Tooltip from '@material-ui/core/Tooltip'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import fs from '../fs/fs'
import {
    getFileExt,
    getFileExtReal,
    getFileName,
    formatBytes,
    getSettingsFsView,
    getFileNameCorrect,
} from '../functions'
import {
    //setFsCurrentId,
    setFsCurrentDir,
    setFsCurrentList,
    setZippedFile,
    sandboxedfileStore,
} from '../actions'
import {
    mdiCheck,
    mdiChevronLeft,
    mdiClose,
    mdiContentCopy,
    mdiContentCut,
    mdiContentPaste,
    mdiContentSaveOutline,
    mdiDeleteOutline,
    mdiDotsHorizontal,
    mdiExportVariant,    
    mdiFolderPlusOutline,
    mdiSquareEditOutline,
} from '@mdi/js'

const styles = theme => ({
    table: {
        minWidth: 250,
    },
    toolbarButtons: {
        marginLeft: 'auto',
        marginRight: -20,
    },
    leftButtons: {
        marginLeft: -25,
    },
    textPaper: {
        padding: '2px 4px',
        display: 'flex',
        alignItems: 'center',
        width: 250,
    },
    textInput: {
        marginLeft: theme.spacing(1),
        flex: 1,
    },
    textButton: {
        padding: 10,
    },
})

class FsUI extends PureComponent {
    constructor(props) {
        super(props)
        this.cut = false
        this.saveAsField = React.createRef()
      }

    state = {
        textFieldLabel: '',
        textFieldValue: '',
        selected: [],
        selectedCopy: [],
        visibleTextField: false,
        visibleDeleteDlg: false,
        visibleImportExport: false,
        visibleAlreadyExistDlg: false,
        visibleOSaveAsDlg: false,
    }

    componentDidMount() {
        this.fsListDir(this.props.fsCurrentDir)
    }

    componentDidUpdate(previousProps) {
        //console.log('componentDidUpdate: ', this.props)
        if (this.props.fsZippedFile !== null) {
            const zip = new JSZip()
            zip.loadAsync(this.props.fsZippedFile).then((contents) => {
                //console.log('zip file contents: ', contents)
                contents.forEach((relativePath, zipEntry) => {
                    //console.log('zipEntry: ', zipEntry)
                    if (zipEntry.dir) { 
                        //console.log('dir relativePath: ', relativePath)
                    } else {                  
                        //console.log('file relativePath: ', relativePath)
                        zip.file(relativePath).async('uint8array').then((content) => {
                            this.fsAddItem(relativePath, content)
                        })
                    }
                })
            }).then(() => {
                this.props.setFsZippedFile(null)
                //this.fsListDir(this.props.fsCurrentDir)
            })
        } else {
            this.fsListDir(this.props.fsCurrentDir)
        }
    }

    fsBuildParent(parent, name) {
        let newParent = ''
        if (parent === '') {
            if (name !== '') 
                newParent = name
        } else {
            if (name !== '') 
                newParent = `${parent}/${name}` 
            else
                newParent = parent
        }
        return newParent
    }

    fsAddItem(filename, data) {
        //console.log('fsAddItem filename: ', filename)
        //console.log('fsAddItem data: ', data)
        let components = filename.split('/')
        const name = components.pop()
        const parent = this.fsBuildParent(this.props.fsCurrentDir, components.join('/'))
        //console.log(`add file, parent: ${parent}, name: ${name}`)
        fs.transaction('rw', fs.files, async () => {
            await fs.files.add({
                parent: parent,
                name: name,
                type: getFileExt(name),
                size: data.length,
                data: data
            })             
        }).then(() => {
            // store subdirectory
            while (components.length > 0) {
                const name = components.pop()
                const parent = this.fsBuildParent(this.props.fsCurrentDir, components.join('/'))
                //console.log(`put dir, parent: ${parent}, name: ${name}`)
                fs.transaction('rw', fs.files, async () => {
                    await fs.files.put({
                        parent: parent,
                        name: name,
                        type: 'dir',
                        size: '' 
                    }) 
                }).then(() => {
                    this.fsListDir(this.props.fsCurrentDir)
                })
            }            
        })
    }

    fsExistDir(dir, create = true) {
        const item = this.props.fsCurrentList.find(e => e.name === dir)
        if (item !== undefined) {
            if (create) {
                this.fsCreateDir(this.props.fsCurrentDir, dir)
                return true
            } else return false
        } else return false
    }

    fsListDir(dir) {
        //console.log('fsListDir: ', dir)
        let listItems = []
        fs.transaction('r', fs.files, async ()=> {
            await fs.files.where({parent: dir, type: 'dir'}).sortBy('name').then((list) => { // first list all dirs
                listItems = list
            }).then(() => { // after list all files
                fs.files.where({parent: dir}).and(item => item.type !== 'dir').sortBy('name').then((list) => {
                    listItems = listItems.concat(list)
                    this.props.setCurrentList(listItems)
                })
            })
        })
    }

    fsCreateDir(parent, name) {
        fs.files.add({parent: parent, name: name, type: 'dir', size: ''}).then(() => { 
            this.fsListDir(this.props.fsCurrentDir)
        })
    }

    createDir = () => {
        this.setState({textFieldLabel: 'new folder name', visibleTextField: !this.state.visibleTextField})
    }

    renameItem = () => {
        this.lastSelected = this.state.selected[this.state.selected.length-1]
        this.setState({textFieldLabel: '', textFieldValue: this.lastSelected, visibleTextField: !this.state.visibleTextField})
    }

    previousDir = () => {
        //console.log('this.state.parentDir: ', this.state.parentDir)
        if (this.props.fsCurrentDir === '') return
        const nextDir = this.props.fsCurrentDir.split('/').slice(0, -1).join('/')
        this.props.setCurrentDir(nextDir)
        this.fsListDir(nextDir)
    }

    confirmText = (e) => {
        if (this.state.textFieldLabel === '') { // it's a rename
            // check if the new name already exist
            const check = this.props.fsCurrentList.find(e => e.name === this.state.textFieldValue)
            if (check !== undefined) {
                this.setState({visibleAlreadyExistDlg: true})
                return
            }
            const item = this.props.fsCurrentList.find(e => e.name === this.lastSelected)
            if (item !== undefined) {
                if (item.type === 'dir') {
                    const oldParent = this.fsBuildParent(item.parent, item.name)
                    const newParent = this.fsBuildParent(item.parent, this.state.textFieldValue)
                    // rename parent for all subitems
                    fs.transaction('rw', fs.files, async ()=> {
                        await fs.files.where({parent: oldParent}).each((e) => {
                            fs.transaction('rw', fs.files, async () => { // since is a new primary key then add it as new item 
                                await fs.files.add({
                                parent: newParent,
                                name: e.name,
                                type: e.type,
                                size: e.size,
                                data: e.data
                                }).then(() => { // then delete old one
                                    fs.files.where({parent: oldParent}).delete()
                                })
                            })
                        })
                    })
                } 
                fs.transaction('rw', fs.files, async () => { // a new primary key, add it as new item 
                    await fs.files.add({
                      parent: item.parent,
                      name: this.state.textFieldValue,
                      type: item.type,
                      size: item.size,
                      data: item.data
                    }).then(() => { // then delete old one
                        fs.files.where({parent: item.parent, name: item.name}).delete()
                    })
                })
                this.setState({visibleTextField: false})
                this.fsListDir(this.props.fsCurrentDir)                
            }
        } else { // it's a new directory
            this.setState({visibleTextField: false}, () => {
                this.fsCreateDir(this.props.fsCurrentDir, this.state.textFieldValue)
            })
        }
    }

    cancelDir = () => {
         this.setState({visibleTextField: false})
    }

    saveItem = () => {
        //console.log('this.props.localfileStore: ', this.props.localfileStore)
        //console.log('this.props.sandboxedFile: ', this.props.sandboxedFile)
        if (this.props.localfileStore !== null) {
            const file = this.props.localfileStore
            if (file === null) return
            let reader = new FileReader()
            reader.onload = (event) => {
                let buffer = event.target.result
                const ext = getFileExtReal(file.name)
                const name = getFileName(getFileNameCorrect(file.name))   
                let newName = name
                let counter = 0
                let done = false             
                do {
                    let filename = ext === '' ? newName : `${newName}.${ext}`
                    const checkName = this.props.fsCurrentList.find(e => e.name === filename)
                    if (checkName === undefined) {
                        fs.transaction('rw', fs.files, async () => {
                            await fs.files.add({
                                parent: this.props.fsCurrentDir,
                                name: filename,
                                type: getFileExt(name),
                                size: file.size,
                                data: buffer
                            })
                        }).then(() => {
                            this.fsListDir(this.props.fsCurrentDir)
                        })
                        done = true
                    } else {
                        newName = `${name} - Copy`
                        if (counter > 0) newName = `${newName} (${counter})`
                        counter++
                    }
                } while (!done)
            }
            reader.readAsArrayBuffer(file)
        } else if (this.props.sandboxedFile !== null) {
            const file = this.props.sandboxedFile
            let buffer = file.data
            const ext = getFileExtReal(file.name)
            const name = getFileName(getFileNameCorrect(file.name))   
            let newName = name
            let counter = 0
            let done = false             
            do {
                let filename = ext === '' ? newName : `${newName}.${ext}`
                const checkName = this.props.fsCurrentList.find(e => e.name === filename)
                if (checkName === undefined) {
                    fs.transaction('rw', fs.files, async () => {
                        await fs.files.add({
                            parent: this.props.fsCurrentDir,
                            name: filename,
                            type: getFileExt(name),
                            size: file.size,
                            data: buffer
                        })
                    }).then(() => {
                        this.fsListDir(this.props.fsCurrentDir)
                    })
                    done = true
                } else {
                    newName = `${name} - Copy`
                    if (counter > 0) newName = `${newName} (${counter})`
                    counter++
                }
            } while (!done)           
        }
    }

    copyItem = () => {
        let newSelectedCopy = []
        this.state.selected.forEach(name => {
            const item = this.props.fsCurrentList.find(e => e.name === name)
            if (item !== undefined) {
                newSelectedCopy.push({parent: item.parent, name: item.name})
            }
        })
        this.setState({selectedCopy: newSelectedCopy})
    }

    cutItem = () => {
        let newSelectedCopy = []
        this.state.selected.forEach(name => {
            let item = this.props.fsCurrentList.find(e => e.name === name)
            if (item !== undefined) {
                newSelectedCopy.push({parent: item.parent, name: item.name})
            }
        })
        this.setState({selectedCopy: newSelectedCopy})
        this.cut = true
    }

    pasteItem = () => {
        //console.log('this.state.selectedCopy: ', this.state.selectedCopy)
        //console.log('this.props.fsCurrentList: ', this.props.fsCurrentList)
        this.state.selectedCopy.forEach(async (selected, index) => {
            await fs.files.where({parent: selected.parent, name: selected.name}).first((item) => {
                if (item !== undefined) {
                    //console.log('item: ', item)
                    if (item.type === 'dir') {
                        // create a new name
                        let counter = 0
                        let done = false
                        let newName = item.name
                        do {
                            let filename = newName
                            const checkName = this.props.fsCurrentList.find(e => e.name === filename)
                            if (checkName === undefined) {
                                done = true
                            } else {
                                newName = `${item.name} - Copy`
                                if (counter > 0) newName = `${newName} (${counter})`
                                counter++
                            }
                        } while (!done)   
                        //console.log('this.props.fsCurrentDir: ', this.props.fsCurrentDir)
                        //console.log('newName: ', newName)
                        // copy the folder
                        fs.files.add({
                            parent: this.props.fsCurrentDir,
                            name: newName,
                            type: item.type,
                            size: item.size,
                            data: item.data
                        })   
                        // copy all subdirs and files
                        const oldParent = this.fsBuildParent(item.parent, item.name) 
                        const newParent = this.fsBuildParent(this.props.fsCurrentDir, newName) 
                        //console.log('oldParent: ', oldParent)
                        //console.log('newParent: ', newParent)
                        let listItems = []
                        fs.files.where('parent').startsWithIgnoreCase(oldParent).each((e) => {
                            listItems.push(e)
                        }).then(() => {
                            listItems.forEach(e => {
                                //console.log('listItems e: ', e)
                                //const parent = e.parent.replace(oldParent, newParent)
                                //console.log('parent: ', parent)
                                fs.files.add({
                                    parent: newParent,
                                    name: e.name,
                                    type: e.type,
                                    size: e.size,
                                    data: e.data
                                })                          
                            })                            
                        })
                    } else { // it's a file
                        const ext = getFileExtReal(item.name)
                        const name = getFileName(item.name)    
                        let newName = name
                        let counter = 0
                        let done = false             
                        do {
                            let filename = ext === '' ? newName : `${newName}.${ext}`
                            const checkName = this.props.fsCurrentList.find(e => e.name === filename)
                            if (checkName === undefined) {
                                fs.transaction('rw', fs.files, async () => {
                                    await fs.files.add({
                                        parent: this.props.fsCurrentDir,
                                        name: filename,
                                        type: item.type,
                                        size: item.size,
                                        data: item.data
                                    })
                                })
                                done = true
                            } else {
                                newName = `${name} - Copy`
                                if (counter > 0) newName = `${newName} (${counter})`
                                counter++
                            }
                        } while (!done)
                    }
                }
            })
            if (index === this.state.selectedCopy.length-1) {
                if (this.cut) {
                    this.state.selectedCopy.forEach((selected) => {
                        fs.files.where({parent: selected.parent, name: selected.name}).delete()
                    })
                    this.setState({selectedCopy: []})
                    this.cut = false                    
                }
                this.fsListDir(this.props.fsCurrentDir)
            }
        })
        this.setState({selected: []})
    }

    deleteItem = () => {
        this.state.selected.forEach(name => {
            let item = this.props.fsCurrentList.find(e => e.name === name)
            if (item !== undefined) {
                if (item.type === 'dir') { // delete also all subitems
                    fs.files.where('parent').startsWithIgnoreCase(this.fsBuildParent(item.parent, item.name)).delete()
                }
                fs.files.where({parent: item.parent, name: item.name}).delete().then(() => {
                    this.fsListDir(this.props.fsCurrentDir)
                })
            }
        })
        this.setState({selected: []}) 
    }

    showImportExport = () => {
        this.setState({visibleImportExport: !this.state.visibleImportExport})
    }

    exportItem = () => {
        if (this.state.selected.length === 0) return
        this.setState({visibleOSaveAsDlg: true})
    }

    itemClick = (e, row) => {
        //console.log('itemClick: ', row.name)
        const selectedIndex = this.state.selected.indexOf(row.name)
        //console.log('selectedIndex: ', selectedIndex)
        let newSelected = []
        if (selectedIndex === -1) {
            newSelected = newSelected.concat(this.state.selected, row.name)
        } else if (selectedIndex >= 0) {
            newSelected = newSelected.concat(
                this.state.selected.slice(0, selectedIndex),
                this.state.selected.slice(selectedIndex + 1),
            )
        }
        this.setState({selected: newSelected}, () => {
        //    console.log('this.state.selected: ', this.state.selected)
        })
    }

    itemDoubleClick = (e, item) => {
        //console.log('itemDoubleClick: ', item.name)
        if (item.type === 'dir') {
            this.props.setCurrentDir(this.fsBuildParent(item.parent, item.name))
        } else if (item.name === 'DICOMDIR') {
            this.props.onOpenDicomdir(item)
        } else {
            this.props.setSandboxedfileStore(item)
            this.props.onOpen(item)
        }
    }

    showDeleteDlg = () => {
        this.setState({ visibleDeleteDlg: true })
      }
    
    hideDeleteDlg = () => {
        this.setState({ visibleDeleteDlg: false })
    }

    confirmDeleteDlg = () => {
        this.hideDeleteDlg()
        this.deleteItem()
    }

    hideAlreadyExistDlg = () => {
        this.setState({ visibleAlreadyExistDlg: false })
    }  

    hideSaveAs = () => {
        this.setState({ visibleOSaveAsDlg: false })
    }

    closeSaveAs = () => {
        const filename = `${this.saveAsField.value}.zip`
        this.setState({ visibleOSaveAsDlg: false },
            () => {
            let zip = new JSZip()
            let listItems = []
            fs.files.where('parent').startsWithIgnoreCase(this.props.fsCurrentDir).each((e) => {
                listItems.push(e)
            }).then(() => {
                listItems.forEach((e) => {
                    if (e.type !== 'dir') {
                        zip.folder(e.parent).file(e.name, e.data)
                    }
                })
                zip.generateAsync({type:"blob"}).then(blob => {
                    saveAs(blob, filename)
                })
            })
        })
    }    

    mouseDown = (e, item) => {
        this.timer = setTimeout(() => { 
            this.itemDoubleClick(e, item)
        }, 500)
    }

    mouseUp = (e) => {
        clearTimeout(this.timer)
    }

    render() {   
        const { classes } = this.props
        const isSelected = name => this.state.selected.indexOf(name) !== -1
        const visibleTextField = this.state.visibleTextField
        const visibleImportExport = this.state.visibleImportExport
        const visibleDeleteDlg = this.state.visibleDeleteDlg
        const visibleAlreadyExistDlg = this.state.visibleAlreadyExistDlg
        const visibleOSaveAsDlg = this.state.visibleOSaveAsDlg

        let styleComponent = null
        if (getSettingsFsView() === 'bottom') {
            styleComponent = {marginTop: '0px', height: '275px'}
        } else {
            styleComponent = {marginTop: '48px', width: '350px'}
        }

        return (
            <div style={styleComponent}>
                { visibleTextField ? 
                    <Paper component="form" className={classes.textPaper}>
                        <InputBase
                            autoFocus
                            className={classes.textInput}
                            placeholder={this.state.textFieldLabel}
                            defaultValue={this.state.textFieldValue}
                            onChange={(event) => {
                                this.setState({textFieldValue: event.target.value})
                            }}
                        />
                        <IconButton className={classes.textButton} onClick={this.confirmText}>
                            <Icon path={mdiCheck} size={'1.2rem'} color={this.props.color} />
                        </IconButton>
                        <IconButton className={classes.textButton} onClick={this.cancelDir}>
                            <Icon path={mdiClose} size={'1.2rem'} color={this.props.color} />
                        </IconButton>                        
                    </Paper>
                  : 
                    <div>
                        <Toolbar variant="dense">
                            <div className={classes.leftButtons}>
                                <IconButton color="inherit" onClick={this.previousDir} >
                                    <Icon path={mdiChevronLeft} size={'1.2rem'} color={this.props.color} />
                                </IconButton>                            
                            </div>
                            <div className={classes.toolbarButtons}>
                                <Tooltip title="Create a new directory">
                                    <IconButton color="inherit" onClick={this.createDir}>
                                        <Icon path={mdiFolderPlusOutline} size={'1.2rem'} color={this.props.color} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Rename the last selected item">
                                    <IconButton color="inherit" onClick={this.renameItem}>
                                        <Icon path={mdiSquareEditOutline} size={'1.2rem'} color={this.props.color} />
                                    </IconButton> 
                                </Tooltip>
                                <Tooltip title="Move the selected items to the clipboard">                          
                                    <IconButton color="inherit" onClick={this.cutItem}>
                                        <Icon path={mdiContentCut} size={'1.2rem'} color={this.props.color} />
                                    </IconButton> 
                                </Tooltip>  
                                <Tooltip title="Copy the selected items to the clipboard">
                                    <IconButton color="inherit" onClick={this.copyItem}>
                                        <Icon path={mdiContentCopy} size={'1.2rem'} color={this.props.color} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Paste clipboard contents to current location">                             
                                    <IconButton color="inherit" onClick={this.pasteItem}>
                                        <Icon path={mdiContentPaste} size={'1.2rem'} color={this.props.color} />
                                    </IconButton>   
                                </Tooltip>  
                                <Tooltip title="Delete the selected items">    
                                    <IconButton color="inherit" onClick={this.showDeleteDlg}>
                                        <Icon path={mdiDeleteOutline} size={'1.2rem'} color={this.props.color} />
                                    </IconButton>  
                                </Tooltip>
                                <IconButton color="inherit" onClick={this.showImportExport}>
                                    <Icon path={mdiDotsHorizontal} size={'1.2rem'} color={this.props.color} />
                                </IconButton>                           
                            </div>            
                        </Toolbar>
                        { visibleImportExport ?
                            <Toolbar variant="dense">
                                <div className={classes.toolbarButtons}>
                                    <Tooltip title="Save the selected image to sandboxed file system"> 
                                        <IconButton color="inherit" onClick={this.saveItem}>
                                            <Icon path={mdiContentSaveOutline} size={'1.2rem'} color={this.props.color} />
                                        </IconButton>      
                                    </Tooltip>
                                    <Tooltip title="Export the selected items as zipped archive">
                                        <IconButton color="inherit" onClick={this.exportItem}>
                                            <Icon path={mdiExportVariant} size={'1.2rem'} color={this.props.color} />
                                        </IconButton>   
                                    </Tooltip>     
                                    {/*<IconButton color="inherit" onClick={this.downloadItem}>
                                        <Icon path={mdiDownload} size={'1.2rem'} color={this.props.color} />
                                    </IconButton>*/}                                     
                                </div>            
                            </Toolbar>
                        : null
                        }
                    </div>
                }
                <div>
                    <TableContainer component={Paper}>
                        <Table className={classes.table} size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell align="left">Type</TableCell>
                                    <TableCell align="left">Size</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                            {this.props.fsCurrentList.map((row) => {
                                const isItemSelected = isSelected(row.name)
                                return (
                                    <TableRow 
                                        key={`${row.parent}/${row.name}`} 
                                        role='button' 
                                        hover
                                        selected={isItemSelected}
                                        onClick={(e) => {this.itemClick(e, row)}}
                                        onDoubleClick={(e) => {this.itemDoubleClick(e, row)}}
                                        onTouchStart={(e) => this.mouseDown(e, row)} 
                                        onTouchEnd={(e) => this.mouseUp(e, row)}
                                        onMouseDown={(e) => this.mouseDown(e, row)} 
                                        onMouseUp={(e) => this.mouseUp(e, row)}
                                    >
                                        <TableCell component="th" scope="row">
                                            {row.name}
                                        </TableCell>
                                        <TableCell align="left">{row.type}</TableCell>
                                        <TableCell align="left">{formatBytes(row.size)}</TableCell>
                                    </TableRow>
                                )
                            })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </div>   

                <Dialog
                    open={visibleDeleteDlg}
                    onClose={this.hideDeleteDlg}
                >
                    <DialogTitle>{"Are you sure to delete selected items?"}</DialogTitle>
                    <DialogActions>
                        <Button onClick={this.hideDeleteDlg}>
                            Cancel
                        </Button>
                        <Button onClick={this.confirmDeleteDlg} autoFocus>
                            Ok
                        </Button>
                    </DialogActions>
                </Dialog>    

                <Dialog
                    open={visibleAlreadyExistDlg}
                    onClose={this.hideAlreadyExistDlg}
                >
                    <DialogTitle>{"An item with this name already exists!"}</DialogTitle>
                    <DialogActions>
                        <Button onClick={this.hideAlreadyExistDlg} autoFocus>
                            Ok
                        </Button>
                    </DialogActions>
                </Dialog>    

                <Dialog
                    open={visibleOSaveAsDlg}
                >
                    <DialogTitle>Export archive</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            Specify a file name for the archive:
                        </DialogContentText>
                        <TextField
                            autoFocus
                            margin="dense"
                            id="id-open-url"
                            inputRef={input => (this.saveAsField = input)}
                            fullWidth
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => this.hideSaveAs()} >
                            Cancel
                        </Button>
                        <Button onClick={() => this.closeSaveAs()}>
                            Ok
                        </Button>
                    </DialogActions>
                </Dialog>                              
            </div>
        )
    }              
}

const mapStateToProps = (state) => {
    return {
      localfileStore: state.localfile,
      fsCurrentDir: state.fsCurrentDir,
      fsCurrentList: state.fsCurrentList,
      fsZippedFile: state.fsZippedFile,
      fsRefresh: state.fsRefresh,
      sandboxedFile: state.sandboxedFile,
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        setCurrentDir: (dir) => dispatch(setFsCurrentDir(dir)),
        setCurrentList: (list) => dispatch(setFsCurrentList(list)),
        setFsZippedFile: (file) => dispatch(setZippedFile(file)),
        setSandboxedfileStore: (file) => dispatch(sandboxedfileStore(file)),
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(withStyles(styles)(FsUI))
