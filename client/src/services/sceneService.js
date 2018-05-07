import * as THREE from '../extend/THREE'
import ArrayUtils from './arrayUtils'
import GeometryUtils from './GeometryUtils'
import ConsoleUtils from './consoleUtils'
import ToastService from './ToastService'
import {
  SELECT_MODE_NEW,
  SELECT_MODE_ADD,
  SELECT_MODE_SUB,
  SELECT_MODE_INTERSECT
} from '../components/Options/optionsComponent'

let onClick = (event, scene, camera, renderer) => {
  let result = {
    point: undefined, // new THREE.Vector3
    activeEntities: []
  }
  let canvas = event.target.tagName === 'CANVAS' && event.target
  if (!canvas) {
    if (renderer.domElement) {
      canvas = renderer.domElement
    } else {
      return
    }
  }

  let canvasOffset = getOffset(canvas)

  let rayCaster = new THREE.Raycaster() // create once
  let mouse = new THREE.Vector3((event.pageX - canvasOffset.left) / (canvas.clientWidth - 1) * 2 - 1, -((event.pageY - canvasOffset.top) / (canvas.clientHeight - 1)) * 2 + 1, 0)
  rayCaster.setFromCamera(mouse, camera)

  // get mouse coordinates
  mouse.unproject(camera)
  result.point = mouse

  rayCaster.intersectObjects(scene.children, true).forEach(intersection => {
    if (result.activeEntities.indexOf(intersection.object) < 0) {
      result.activeEntities.push(intersection.object)
    }
  })

  result.activeEntities.forEach(function (line) {
    if (line.geometry.type === 'Geometry') {
      line.userData.mouseDistance = GeometryUtils.distanceToLine(result.point, line)
    } else if (line.geometry.type === 'CircleGeometry') {
      line.userData.mouseDistance = GeometryUtils.distanceToArc(result.point, line)
    }
  })
  let compare = (a, b) => {
    if (a.userData.mouseDistance > b.userData.mouseDistance) return 1
    if (a.userData.mouseDistance < b.userData.mouseDistance) return -1
  }
  result.activeEntities.sort(compare)

  return result
}

let doSelection = (selectResult, editor) => {
  highlightEntities(editor, editor.activeEntities, true, undefined, false)
  switch (editor.options.selectMode) {
    case SELECT_MODE_NEW:
      editor.activeEntities = selectResult
      break
    case SELECT_MODE_ADD:
      editor.activeEntities = ArrayUtils.union(editor.activeEntities, selectResult)
      break
    case SELECT_MODE_SUB:
      editor.activeEntities = ArrayUtils.subtract(editor.activeEntities, selectResult)
      break
    case SELECT_MODE_INTERSECT:
      editor.activeEntities = ArrayUtils.intersection(editor.activeEntities, selectResult)
      break
    default:
      console.warn(`Unhandled select mode ${editor.options.selectMode}`)
  }
  highlightEntities(editor, editor.activeEntities)

  return editor.activeEntities
}

let render = (editor) => {
  let {renderer, scene, camera} = editor
  renderer.render(scene, camera)
}

let highlightEntities = (editor, entities, restoreColor = false, color = 0x0000FF, doRender = true) => {
  // console.warn({editor, activeEntities: editor.activeEntities})

  if (!Array.isArray(entities)) {
    entities = [entities]
  }

  entities.forEach(entity => {
    // upd color
    if (restoreColor) {
      delete entity.userData.showInTop
      if (entity.userData.originalColor) {
        entity.material.color = entity.userData.originalColor
        delete entity.userData.originalColor
      }
    } else {
      if (!entity.userData.originalColor) {
        entity.userData.originalColor = entity.material.color
      }
      entity.material.color = new THREE.Color(color)
    }
    // entity.geometry.computeLineDistances();
    entity.material.needUpdate = true
  })
  if (doRender) {
    render(editor)
  }
}

function shotPoints (vertex, distance = 0.1) {
  let vertices = []

  let tmp = vertex.clone()
  tmp.x += distance
  vertices.push(tmp)

  tmp = vertex.clone()
  tmp.x -= distance
  vertices.push(tmp)

  tmp = vertex.clone()
  tmp.y += distance
  vertices.push(tmp)

  tmp = vertex.clone()
  tmp.y -= distance
  vertices.push(tmp)

  return vertices
}

function getNeighbours (entity, editor, entities = []) {
  let {scene} = editor

  let vertices = []

  if (entity.geometry instanceof THREE.CircleGeometry) {
    // arc

    let vertex = new THREE.Vector3(0, 0, 0)
    vertices.push(vertex.addVectors(entity.geometry.vertices[0], entity.position))

    vertex = new THREE.Vector3(0, 0, 0)
    vertices.push(vertex.addVectors(entity.geometry.vertices[entity.geometry.vertices.length - 1], entity.position))
  } else {
    // line?
    vertices = entity.geometry.vertices
  }

  vertices.forEach(vertex => {
    let tmpVertices = [vertex].concat(shotPoints(vertex, 0.1))

    tmpVertices.forEach(tmpVertex => {
      let rayCaster = new THREE.Raycaster(tmpVertex, new THREE.Vector3(0, 0, 1))

      // TODO: intersection on same layer

      let objects = scene.children
      if (editor.options.singleLayerSelect) {
        let layerName = entity.parent.name
        scene.children.forEach(child => {
          if (child.name === 'Layers') {
            child.children.forEach(layer => {
              if (layer.name === layerName) {
                objects = layer.children
              }
            })
          }
        })
      }

      let intersections = rayCaster.intersectObjects(objects, true)

      intersections.forEach(intersect => {
        if (entities.indexOf(intersect.object) < 0) {
          // object not in array yet, check

          let checkVertices = []
          if (intersect.object.geometry instanceof THREE.CircleGeometry) {
            let vertex = new THREE.Vector3(0, 0, 0)
            checkVertices.push(vertex.addVectors(intersect.object.geometry.vertices[0], intersect.object.position))

            vertex = new THREE.Vector3(0, 0, 0)
            checkVertices.push(vertex.addVectors(intersect.object.geometry.vertices[intersect.object.geometry.vertices.length - 1], intersect.object.position))
          } else {
            checkVertices = intersect.object.geometry.vertices
          }

          checkVertices.forEach(checkVertex => {
            if (checkVertex.distanceTo(vertex) < editor.options.threshold) {
              entities.push(intersect.object)
              getNeighbours(intersect.object, editor, entities)
            }
          })
        }
      })
    })
  })

  return entities
}

let recursiveSelect = (object, editor) => {
  let entities = getNeighbours(object, editor)
  entities.push(object)

  // unique entities
  entities = [...new Set(entities)]

  entities = GeometryUtils.skipZeroLines(entities, editor.options.threshold)

  let area = calcArea(entities)
  let lineLength = calcLength(entities)
  let size = calcSize(entities)
  console.log('object area: ' + area.toFixed(4) + '<br />length: ' + lineLength.toFixed(4) + '<br /><b>Size:</b><br />Width: ' + size.x.toFixed(4) + '<br />Height: ' + size.y.toFixed(4))

  return entities
}

let calcArea = (entities) => {
  let vertices = getSerialVertices(entities)
  let sumX = 0
  let sumY = 0
  let multipleIdx = 0
  for (let i = 0; i < vertices.length; i++) {
    multipleIdx = i + 1
    if (multipleIdx >= vertices.length) {
      multipleIdx = 0
    }
    sumX += vertices[i].x * vertices[multipleIdx].y
    sumY += vertices[multipleIdx].x * vertices[i].y
  }
  return Math.abs((sumY - sumX) / 2)
}

let calcLength = entities => {
  let total = 0
  entities.forEach(entity => {
    entity.computeLineDistances()
    total += entity.geometry.lineDistances[entity.geometry.lineDistances.length - 1]
  })
  return total
}

let calcSize = entities => {
  let init = false
  let left, top, right, bottom

  entities.forEach(entity => {
    getVertices(entity, true).forEach(vertex => {
      if (!init) {
        init = true
        left = right = vertex.x
        top = bottom = vertex.y
      }
      if (left < vertex.x) { left = vertex.x }
      if (right > vertex.x) { right = vertex.x }
      if (top < vertex.y) { top = vertex.y }
      if (bottom > vertex.y) { bottom = vertex.y }
    })
  })

  // ACHTUNG!
  // swap width and height

  return new THREE.Vector2(Math.abs(top - bottom), Math.abs(left - right))
}

function selectInFrustum (area, container, editor) {
  let planes = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), Math.max(area.x1, area.x2)),
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -Math.min(area.x1, area.x2)),

    new THREE.Plane(new THREE.Vector3(0, -1, 0), Math.max(area.y1, area.y2)),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -Math.min(area.y1, area.y2)),

    new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)
  ]

  let frustum = new THREE.Frustum(
    ...planes
  )

  let iterator = entityIterator(container)

  let frustumIntersects = []

  let entity = iterator.next()
  while (!entity.done) {
    try {
      if (frustum.intersectsObject(entity.value)) {
        frustumIntersects.push(entity.value)
      }
      entity = iterator.next()
    } catch (e) {
      // debugger;
      console.error(e, 'problem with frustrum intersects, at selectInFrustum()')
    }
  }

  let frustumIntersectsFiltered = []

  let geometries = {}

  frustumIntersects.forEach((entity, idx) => {
    // if (idx < 50 || idx > 60 ) return;

    // console.log('item', entity);
    if (entityIntersectArea(entity, area, geometries)) {
      frustumIntersectsFiltered.push(entity)
    }
  })

  // console.timeEnd('selectInFrustum');
  return frustumIntersectsFiltered
}

function entityIntersectArea (entity, area) {
// console.log('ENTITY', entity, 'AREA', area);
  // console.count(entity.geometry.type);

  if (entity.geometry instanceof THREE.CircleGeometry) {
    // arc
    try {
      entity.geometry.vertices.forEach((vertex, idx) => {
        // TODO optimize code
        // skip even vertex for calculation speed. I think three is possibility to check evert fifth vertex...
        if (idx % 2 === 1 && vertexInArea((new THREE.Vector3(0, 0, 0)).addVectors(vertex, entity.position), area)) {
          throw new Error('true')
        }
      })
    } catch (e) {
      return true
    }

    return false
  } else {
    // console.log('LINE', entity);

    // check if any vertex in selected area;
    try {
      entity.geometry.vertices.forEach(vertex => {
        if (vertexInArea(vertex, area)) {
          throw new Error('true')
        }
      })
    } catch (e) {
      return true
    }

    // check if line intersect area
    try {
      let prevVertex

      entity.geometry.vertices.forEach(vertex => {
        if (prevVertex) {
          // console.log(area);
          // x1,y1 - x2,y1
          // x1,y1 - x1,y2
          // x1,y2 - x2,y2
          // x2,y1 - x2,y2
          if (
            GeometryUtils.linesIntersect(prevVertex, vertex, new THREE.Vector3(area.x1, area.y1, 0), new THREE.Vector3(area.x2, area.y1, 0)) ||
            GeometryUtils.linesIntersect(prevVertex, vertex, new THREE.Vector3(area.x1, area.y1, 0), new THREE.Vector3(area.x1, area.y2, 0)) ||
            GeometryUtils.linesIntersect(prevVertex, vertex, new THREE.Vector3(area.x1, area.y2, 0), new THREE.Vector3(area.x2, area.y2, 0)) ||
            GeometryUtils.linesIntersect(prevVertex, vertex, new THREE.Vector3(area.x2, area.y1, 0), new THREE.Vector3(area.x2, area.y2, 0))
          ) {
            throw new Error('true')
          }
        }
        prevVertex = vertex
      })
    } catch (e) {
      return true
    }

    return false
  }

  // alert('Unexpected geometry @ThreeDxf.entityIntersectArea()');
}

function * entityIterator (container, iterateContainers = false) {
  if (iterateContainers) {
    yield container
  }
  for (let child in container.children) {
    if (container.children.hasOwnProperty(child)) {
      if (container.children[child].children.length || container.children[child].userData.container) {
        yield * entityIterator(container.children[child], iterateContainers)
      } else {
        yield container.children[child]
      }
    }
  }
}

let setPointOfInterest = (editor, object) => {
  let stepsCount = 25
  let {camera} = editor

  console.log(editor)
  console.log(editor.cadCanvas)
  console.log(editor.cadCanvas.getControls())

  let controls = editor.cadCanvas.getControls()

  let pointOfInterests
  if (object.geometry instanceof THREE.CircleGeometry) {
    pointOfInterests = object.position
  } else {
    object.geometry.computeBoundingSphere()
    pointOfInterests = object.geometry.boundingSphere.center
  }
  let step = (new THREE.Vector3(0, 0, 0)).subVectors(pointOfInterests, camera.position).divideScalar(stepsCount)

  let radius = object.geometry.boundingSphere.radius
  let canvasDimension
  if (camera.right > camera.top) {
    canvasDimension = camera.top
  } else {
    canvasDimension = camera.right
  }
  let factor = Math.pow(radius / canvasDimension * 2, 1 / stepsCount)

  let stepsLeft = stepsCount

  function animateCameraMove () {
    stepsLeft--
    if (stepsLeft > 0) {
      window.requestAnimationFrame(animateCameraMove)
    }

    step.z = 0
    controls.target.add(step)
    camera.position.add(step)

    camera.left *= factor
    camera.right *= factor
    camera.top *= factor
    camera.bottom *= factor
    camera.updateProjectionMatrix()

    camera.needUpdate = true
    controls.update()
  }

  animateCameraMove()
}

let showAll = editor => {
  let {scene} = editor
  let iterator = entityIterator(scene, true)

  let entity = iterator.next()
  while (!entity.done) {
    try {
      entity.value.visible = true
      entity = iterator.next()
    } catch (e) {
      // debugger
      console.error(e, 'problem with showing all, at showAll()')
    }
  }
  render(editor)
}

let createObject = (editor, name, entities, threshold = 0.000001) => {
  let object
  let {scene} = editor

  let usedEntities = entities.length
  entities = entities.filter(e => !e.userData.belongsToObject)
  usedEntities -= entities.length

  try {
    scene.children.forEach(objectsContainer => {
      if (objectsContainer.name === 'Objects') {
        objectsContainer.children.forEach(object => {
          if (object.name === name) {
            let error = new Error(`Object with name "${name}" already exists`)
            error.userData = {
              error: 'duplicate name',
              msg: error.message,
              name: name
            }
            throw error

            // throw {
            //   error: 'duplicate name',
            //   msg: `Object with name "${name}" already exists`,
            //   name: name
            // }
          }
        })

        // create object (entities container)
        // move entities from layers to object
        // render

        // object = new THREE.Object3D();
        object = new THREE.Group()
        object.name = name
        object.userData['container'] = true
        object.userData['object'] = true
        // object.visible = false;

        try {
          object.userData['edgeModel'] = GeometryUtils.buildEdgeModel({children: entities}, threshold)
          ConsoleUtils.previewObjectInConsole(object)
        } catch (e) {
          console.warn('BUILD EDGE MODEL IN threeDXF')
          console.warn(e)

          let error = new Error('Problem building edge model')
          error.userData = {
            error: 'edge model',
            data: e,
            msg: error.message
          }
          throw error

          // throw {
          //   error: 'edge model',
          //   data: e,
          //   msg: 'Problem building edge model'
          // }
        }

        entities.forEach(entity => {
          // let idx = entity.parent.children.indexOf(entity);
          // entity.parent.children.splice(idx, 1);
          entity.userData.belongsToObject = true
          object.add(entity)
        })

        if (object.children.length) {
          objectsContainer.add(object)
        } else {
          let error = new Error(usedEntities ? 'Selected entities already belongs to object' : 'No entities selected')
          error.userData = {
            error: 'empty object',
            msg: error.message
          }
          throw error

          // throw {
          //   error: 'empty object',
          //   msg: usedEntities ? 'Selected entities already belongs to object' : 'No entities selected'
          // };
        }
      }
    })
  } catch (e) {
    console.error('errore', e)

    switch (e.userData.error) {
      case 'edge model':
        if (e.userData.data && e.userData.data.error) {
          switch (e.userData.data.error) {
            case 'interruption':
              // show problem line
              console.error('show problem line', e)

              this.highlightEntities(entities, true)
              // cadCanvas.highlightEntities($scope.editor.activeEntities, true);

              e.userData.data.entity.userData.showInTop = true
              this.highlightEntities([e.data.entity])
              setPointOfInterest(editor, e.data.entity)

              ToastService.msg(e.userData.msg + '<br />' + e.userData.data.msg)

              break

            case 'intersection':
              // show problem line
              console.error('show intersected lines', e)

              this.highlightEntities(entities, true)
              // cadCanvas.highlightEntities($scope.editor.activeEntities, true);

              // e.data.entity.userData.showInTop = true;
              this.highlightEntities(e.userData.data.entities)
              setPointOfInterest(editor, e.userData.data.entities[0])

              // this.render();
              ToastService.msg(e.userData.msg + '<br />' + e.userData.data.msg)

              break

            case 'unused entities':
              // show unused entity
              console.error('show unused entity', e)
              ToastService.msg(e.userData.msg + '<br />' + e.userData.data.msg)

              break
            default:
              let text = e.userData.msg
              if (e.userData.data && e.userData.data.msg) {
                text += `<br />${e.userData.data.msg}`
              }
              // alert(text);
              ToastService.msg(text)
              break
          }
        } else {
          let text = e.userData.msg
          if (e.userData.data && e.userData.data.msg) {
            text += `<br />${e.userData.data.msg}`
          }
          // alert(text);
          ToastService.msg(text)
        }

        // console.error(e);
        break
      case 'duplicate name':
        // alert(e.msg);
        ToastService.msg(e.userData.msg)
        break
      case 'empty object':
        ToastService.msg(e.userData.msg)
        break
      default:
        throw e
      // break;
    }
    return false
  }

  render(editor)
  return object
}

let lastObjectName = ''
let groupEntities = (editor, entities, objectName) => {
  if (!objectName) {
    objectName = window.prompt('Set object name', lastObjectName)
  }

  if (objectName) {
    lastObjectName = objectName
    try {
      let object = createObject(editor, objectName, entities, editor.options.threshold)
      if (object) {
        lastObjectName = ''
      }
      return object
    } catch (e) {
      console.error(e)
      return false
    }
  }
}

let getObjects = (scene, returnObjects = false) => {
  for (let container of scene.children) {
    if (container.name === 'Objects') {
      if (returnObjects) {
        return container.children
      } else {
        return container
      }
    }
  }
}

let getLayers = scene => {
  for (let container of scene.children) {
    if (container.name === 'Layers') {
      return container
    }
  }
}

let combineEdgeModels = editor => {
  let {scene, options: {threshold}} = editor
  let objects = getObjects(scene, true)
  // console.log('combineEdgeModels', scene, threshold, objects)

  if (!objects.length) {
    let error = new Error('No objects for edge-model')
    error.userData = {
      error: 'no objects',
      msg: error.message
    }
    throw error
  }

  let viewBox = objects[0].userData.edgeModel.svgData.viewBox
  let box = {
    x: viewBox.x,
    y: viewBox.y,
    x2: +viewBox.x + +viewBox.width,
    y2: +viewBox.y + +viewBox.height
  }

  // width, height, x, y
  objects.forEach(object => {
    let objViewBox = object.userData.edgeModel.svgData.viewBox

    box.x = Math.min(box.x, objViewBox.x)
    box.y = Math.min(box.y, objViewBox.y)
    box.x2 = Math.max(box.x2, +objViewBox.x + +objViewBox.width)
    box.y2 = Math.max(box.y2, +objViewBox.y + +objViewBox.height)
  })

  viewBox = {
    x: box.x,
    y: box.y,
    width: Math.abs(+box.x2 - +box.x),
    height: Math.abs(+box.y2 - +box.y)
  }

  let mul = 25 / Math.max(viewBox.width, viewBox.height)

  let collisionPoints = GeometryUtils.getCollisionPoints(objects, threshold)

  collisionPoints = GeometryUtils.filterOverlappingCollisionPoints(collisionPoints)

  collisionPoints = GeometryUtils.filterCollisionPoints(collisionPoints)

  collisionPoints = GeometryUtils.filterCollisionPointsWithSharedEntities(collisionPoints)

  let branches = GeometryUtils.generateCollisionBranches(collisionPoints, threshold)

  // let branches = [];

  // DEVELOPMENT ONLY: generate tree
  // {
  //
  //     function generateTree(branches) {
  //         return branches.map(branch => {
  //             return {
  //                 name: branch.collisionPoint.id,
  //                 children: generateTree(branch.branches)
  //             }
  //         })
  //     }
  //
  //     let tree = [];
  //     branches.forEach(branch => {
  //         tree.push({
  //             name: branch.startPoint.id,
  //             children: generateTree(branch.branches)
  //         });
  //     });
  //     console.log('JSON', JSON.stringify([{'name': 'root', children: tree}]));
  // }

  let paths = GeometryUtils.generateAllPaths(branches)

  // TODO TODO TODO
  // TODO TODO TODO
  // TODO TODO TODO
  // check all paths, one by one.
  //     primary order them by count of collisionPoints
  //     secondary check if path is ok:
  //         - cavity must not intersects with internal regions of object.
  //         - cavity can't by intersected by itself
  //     tertiary if region is ok - skip other regions with that collisionPoints

  paths = paths
    .filter(path => path.collisionPoints.length > 1)
    .sort((pathA, pathB) => pathA.collisionPoints.length - pathB.collisionPoints.length)

  // function shuffleArray(array) {
  //     for (let i = array.length - 1; i > 0; i--) {
  //         let j = Math.floor(Math.random() * (i + 1));
  //         [array[i], array[j]] = [array[j], array[i]];
  //     }
  // }
  //
  // shuffleArray(paths);

  let cavities = []
  // filter paths - check if every used object not in cavity;
  let usedCollisionPoints = []

  // debugger;
  let iterator = GeometryUtils.queueIterator(paths)
  let queue = iterator.next()
  while (!queue.done) {
    let cavityToCheck = queue.value

    let result = GeometryUtils.checkCavity(cavityToCheck, usedCollisionPoints, threshold)
    if (result.needToCheckAgain) {
      queue = iterator.next(cavityToCheck)
    } else {
      if (result.valid) {
        cavities.push(cavityToCheck)
        usedCollisionPoints.push(...cavityToCheck.collisionPoints)
      }
      queue = iterator.next()
    }
  }

  // debugger;

  console.warn('PATHS', paths, branches, {cavities})

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${(viewBox.width * mul).toFixed(4)}cm" height="${(viewBox.height * mul).toFixed(4)}cm" viewBox="${viewBox.x.toFixed(4)} ${viewBox.y.toFixed(4)} ${viewBox.width.toFixed(4)} ${viewBox.height.toFixed(4)}">
<desc>
      <schema desc="BuildingSVG" version="1.1"></schema>
      <constr id="Dummy" scale="1"></constr>
    </desc>
    <g id="group_d">${
  objects.map(object => {
    // console.log('SVG BUILDER', object);
    return `<path d="${object.userData.edgeModel.svgData.pathD} " style="fill:rgb(200,240,200);stroke:black;stroke-width:0.00001">
                         <matprop type="const" id="O-1036" lambda="160" eps="0.9" density="2800"></matprop>
                         <area value="0.002" />
                       </path>
                       <circle cx="${(object.userData.edgeModel.svgData.insidePoint.x / 1000).toFixed(4)}" cy="${(object.userData.edgeModel.svgData.insidePoint.y / 1000).toFixed(4)}" r="0.0005" style="fill:rgb(150,255,150); stroke:black;stroke-width:0.00001" />` +
        object.userData.edgeModel.svgData.subRegionsPathD.map(pathD => {
          return `<path d="${pathD} " style="fill:rgb(200,200,240);opacity:0.5; stroke:black;stroke-width:0.00001">
                             <matprop type="cavity_10077-2" id="O-2000" lambda="0" eps="0.9" density="0"></matprop>
                             <area value="0.01" />
                           </path>`
        }).join('')
  }).join('')
}
  <g id="temperature">
<bcprop id="External" x="-0.3606" y="-0.1793" temp="273.15" rs="0.04" rel_img="SvgjsImage1089" rel_id="0" rel="min"></bcprop>
<bcprop id="External" x="-0.1796" y="-0.1793" temp="273.15" rs="0.04" rel_img="SvgjsImage1090" rel_id="1" rel="max"></bcprop>
<bcprop id="Interior" x="-0.2036" y="-0.1073" temp="293.15" rs="0.13" rel_img="SvgjsImage1091" rel_id="2" rel="min"></bcprop>
<bcprop id="Interior" x="-0.3606" y="-0.1073" temp="293.15" rs="0.13" rel_img="SvgjsImage1092" rel_id="3" rel="max"></bcprop>
  </g>
  <g id="collisions">
    ${
  collisionPoints.map(collisionPoint => {
    let dot = ''
    for (let i = 0; i <= collisionPoint.id; i++) {
      // dot += `<circle cx="${((collisionPoint.point.x + i + 3 + collisionPoint.id * 2) / 1000).toFixed(4)}" cy="${((collisionPoint.point.y - i - 3 - collisionPoint.id * 2) / 1000).toFixed(4)}" r="0.0002" style="fill:rgb(${collisionPoint.id === 1 ? '0,0,0' : '200,200,255'}); stroke:black;stroke-width:0.00001" />`;
    }
    return `<circle cx="${(collisionPoint.point.x / 1000).toFixed(4)}" cy="${(collisionPoint.point.y / 1000).toFixed(4)}" r="${collisionPoint.processed ? '0.0005' : '0.0005'}" style="fill:rgb(${collisionPoint.processed ? '255,200,200' : '200,200,255'}); stroke:black;stroke-width:0.00001" />` + dot
  }).join('')
}
  </g>
  <g id="cavities">
    ${
  cavities.map(pathData => {
    let path = pathData.path
    // console.warn('PATH render', path, cavities.length);
    // let circles = ''

    let vertexList = []

    let last = path[path.length - 1]
    let lastVertex = `${(last.x / 1000).toFixed(4)},${(last.y / 1000).toFixed(4)}`
    let pathD = `M${lastVertex} L`

    path.forEach(v => {
      let vertex = `${(v.x / 1000).toFixed(4)},${(v.y / 1000).toFixed(4)}`
      if (vertex !== lastVertex && vertexList.indexOf(vertex) < 0) {
        pathD += `${vertex} `
        lastVertex = vertex
        vertexList.push(vertex)
      }

      // circles += `<circle cx="${(v.x / 1000).toFixed(4)}" cy="${(v.y / 1000).toFixed(4)}" r="0.0002" style="fill:rgb(255,20,20); stroke:black;stroke-width:0.00001" />`
    })
    return `<path d="${pathD} " style="fill:rgb(240,200,200);opacity:0.7;stroke:black;stroke-width:0.0001" />`
  }).join('')
}
  </g>
  </g>
  </svg>`

  // $http.post('http://localhost:4000/api/flixo', {
  //     id: 204406510,
  //     jsonrpc: "2.0",
  //     method: "call",
  //     params: {
  //         frame: "external",
  //
  //         // material_list: flixoExample.material_list,
  //         // svg: flixoExample.svg,
  //         // svg_w_h: flixoExample.svg_w_h,
  //         //
  //         material_list: '[{"id":"0","material":"O-1036"},{"id":"1","material":"O-2000"}]',
  //         svg: svg,
  //         svg_w_h: [{"w": "0.06", "h": "0.04"}, {"w": "0.04", "h": "0.02"}], //objects.map(object => {return {"w": "2.100000", "h": "6.799999"};}),
  //         //
  //         token: "651,ef70663ba61ac6838d127257a284188d38a42314b7193340e8052bf843f889ec,1"
  //
  //     }
  // }).then(response => {
  //     // console.log('RESPO', response.data.message.result);
  //     if (response.data.message.error) {
  //         console.error('FLIXO',response.data.message.error);
  //         console.log(JSON.stringify(response.data.message.error));
  //     } else {
  //         console.log('FLIXO response', response.data.message.result);
  //     }
  //
  //     // console.log('RESPO', response.data.message.error ? response.data.message.error : response.data.message.result);
  // });

  // console.log('data:image/svg+xml;base64,' + window.btoa(svg));
  // console.log('SVG ', svg);

  ConsoleUtils.previewInConsole('data:image/svg+xml;base64,' + window.btoa(svg))
  // CameraUtils.previewInConsole('data:image/svg+xml;base64,' + window.btoa(flixoExample.svg));

  return {
    svg,
    viewBox
  }
}

export default {
  onClick,
  doSelection,
  highlightEntities,
  recursiveSelect,
  calcArea,
  calcLength,
  calcSize,
  selectInFrustum,
  render,
  entityIterator,
  setPointOfInterest,
  showAll,
  groupEntities,
  createObject,
  getObjects,
  getLayers,
  combineEdgeModels
}

function vertexInArea (vertex, area) {
  return ((vertex.x >= Math.min(area.x1, area.x2) && vertex.x <= Math.max(area.x1, area.x2)) && (vertex.y >= Math.min(area.y1, area.y2) && vertex.y <= Math.max(area.y1, area.y2)))
}

function getOffset (elem) {
  let offset = null
  if (elem) {
    offset = {left: 0, top: 0}
    do {
      offset.top += elem.offsetTop
      offset.left += elem.offsetLeft
      elem = elem.offsetParent
    } while (elem)
  }
  return offset
}

function getVertices (entity, allVertices = false) {
  let vertices = []
  if (entity.geometry instanceof THREE.CircleGeometry) {
    // arc
    let vertex = new THREE.Vector3(0, 0, 0)
    if (allVertices) {
      entity.geometry.vertices.forEach(v => {
        vertices.push(vertex.addVectors(v, entity.position))
      })
    } else {
      vertices.push(vertex.addVectors(entity.geometry.vertices[0], entity.position))
      vertex = new THREE.Vector3(0, 0, 0)
      vertices.push(vertex.addVectors(entity.geometry.vertices[entity.geometry.vertices.length - 1], entity.position))
    }
  } else {
    // line?
    vertices = entity.geometry.vertices
  }
  return vertices
}

function getSerialVertices (entities) {
  function buildChain (entities, vertices, currentEntity, vertex, stopVertex) {
    // console.log('buildChain. ENTITIES:', entities, 'VERTICES:', vertices, 'CURRENT_ENTITY', currentEntity, 'VERTEX', vertex, 'STOP_VERTEX', stopVertex);
    if (!currentEntity) {
      if (entities.length) {
        currentEntity = entities[0]
        stopVertex = GeometryUtils.getFirstVertex(currentEntity)
        vertex = stopVertex
        vertices.push(stopVertex)

        if (entities.length === 1) {
          // polygon
          return currentEntity.geometry.vertices
        }
      } else {
        return vertices
      }
    }

    vertex = GeometryUtils.getAnotherVertex(currentEntity, vertex)

    // if current vertex is closely to stopVertex than finish
    if (vertex.distanceTo(stopVertex) < 0.001) {
      // console.log('FIRED STOP VERTEX');
      return vertices
    }

    // find entity (not current)
    let distances = []
    entities.forEach(entity => {
      if (entity === currentEntity) {
        return false
      }

      getVertices(entity).forEach(v => {
        distances.push({
          entity: entity,
          vertex,
          v,
          distance: vertex.distanceTo(v)
        })
      })
    })

    // get closest vertex
    let minDistance = distances.pop()
    distances.forEach(distance => {
      if (distance.distance < minDistance.distance) {
        minDistance = distance
      }
    })

    vertices.push(vertex)
    return buildChain(entities, vertices, minDistance.entity, minDistance.v, stopVertex)
  }

  return buildChain(entities, [])
}
