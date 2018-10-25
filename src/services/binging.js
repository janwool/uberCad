import { choseLinePoint, circleIntersectionAngle, closestPoint, isPoint } from './editObject'
import * as THREE from '../extend/THREE'
import sceneService from './sceneService'
import GeometryUtils from './GeometryUtils'

export const binding = (click, scene, camera, renderer) => {
  let bindingPoint

  if (click.activeEntities.length) {
    const pOnLine = pointOnLine(click.point, click.activeEntities[0])
    if (pOnLine) {
      bindingPoint = pOnLine
      click.binding = 'pointOnLine'
    }

    const crossing = crossingPoint(click.point, click.activeEntities[0])
    if (crossing) {
      bindingPoint = crossing
      click.binding = 'crossing'
    }

    const middle = midline(click.point, click.activeEntities[0])
    if (middle) {
      bindingPoint = middle
      click.binding = 'midline'
    }
  }

  if (!click.binding) {
    const alignmentPoint = alignment(click.point, scene)
    if (alignmentPoint) {
      bindingPoint = alignmentPoint
      click.binding = 'alignment'
    }
  }

  if (!click.binding) {
    const grid = gridPoint(click.point, scene)
    if (grid) {
      bindingPoint = grid
      click.binding = 'gridPoint'
    }
  }

  if (bindingPoint) {
    viewBindingPoint(bindingPoint, scene, camera, renderer)
    click.point = bindingPoint
  } else {
    removeBindingView(scene)
  }
  renderer.render(scene, camera)
  return {...click}
}

let crossingPoint = (pointMouse, line, entrainment = 0.05) => {
  try {
    if (line.type !== 'Points' && pointMouse) {
      entrainment *= 10
      if (line) {
        if (line.geometry.type === 'Geometry') {
          let index = closestPoint(line.geometry.vertices, pointMouse)
          let p = isPoint(pointMouse, entrainment, line.geometry.vertices[index])
          if (p) return {
            x: line.geometry.vertices[index].x,
            y: line.geometry.vertices[index].y
          }
        } else if (line.geometry.type === 'CircleGeometry') {
          let point0 = {}
          let point1 = {}
          point0.x = line.geometry.vertices[0].x + line.position.x
          point0.y = line.geometry.vertices[0].y + line.position.y
          point1.x = line.geometry.vertices[line.geometry.vertices.length - 1].x + line.position.x
          point1.y = line.geometry.vertices[line.geometry.vertices.length - 1].y + line.position.y
          let points = [point0, point1]

          let index = closestPoint(points, pointMouse)
          let p = isPoint(pointMouse, entrainment, points[index])
          if (p) return {
            x: points[index].x,
            y: points[index].y
          }
        }
      }
    }
    return false
  } catch (e) {
    console.error('closestPoint error ', e)
  }
}

let pointOnLine = (point, line) => {
  let result = null
  if (line.type !== 'Points' || line.parent.name !== 'BindingPoint') {
    if (line.geometry instanceof THREE.CircleGeometry) {
      const angle = circleIntersectionAngle(point, line.position)
      result = {
        x: line.position.x + line.geometry.parameters.radius * Math.cos(angle),
        y: line.position.y + line.geometry.parameters.radius * Math.sin(angle)
      }
    } else if (line.geometry instanceof THREE.Geometry) {
      if ((line.geometry.vertices[1].y).toFixed(12) - (line.geometry.vertices[0].y).toFixed(12) === 0) {
        result = {
          x: point.x,
          y: line.geometry.vertices[0].y
        }
      } else if ((line.geometry.vertices[1].x).toFixed(12) - (line.geometry.vertices[0].x).toFixed(12) === 0) {
        result = {
          x: line.geometry.vertices[0].x,
          y: point.y
        }
      } else {
        /**
         * y = kx + b
         * k = (y2 - y1) / (x2 - x1) => (x1, y1) first line point, (x2, y2) second line point,
         * k1 = -1/ k2 => Perpendicular
         * b = y - kx
         * y1 = k1 * x1 + b1
         * y2 = k2 * x2 + b2
         * point intersects y1 & y2 :
         * pointX = (b2 - b1) / (k1 - k2)
         * pointY = k1 * ((b2 - b1) / (k1 - k2)) + b1
         */
        const kLine = (line.geometry.vertices[1].y - line.geometry.vertices[0].y) /
          (line.geometry.vertices[1].x - line.geometry.vertices[0].x)
        const bLine = line.geometry.vertices[0].y - kLine * line.geometry.vertices[0].x
        const kLinePerpendicular = -1 / kLine
        const bLinePerpendicular = point.y - kLinePerpendicular * point.x
        result = {
          x: (bLinePerpendicular - bLine) / (kLine - kLinePerpendicular),
          y: kLine * (bLinePerpendicular - bLine) / (kLine - kLinePerpendicular) + bLine
        }
      }
    }
  }
  return result
}

let gridPoint = (point, scene) => {
  let gridPoints = scene.getObjectByName('GridLayer').children[0]

  if (gridPoints && gridPoints.type === 'Points') {
    let index = closestPoint(gridPoints.geometry.vertices, point)
    return gridPoints.geometry.vertices[index]
  }
}

let viewBindingPoint = (point, scene) => {
  const radius = 0.5
  removeBindingView(scene)

  let geometryArc = new THREE.CircleGeometry(radius, 32, 0, 2 * Math.PI)
  geometryArc.vertices[0] = geometryArc.vertices[32]
  let material = new THREE.LineBasicMaterial({color: 0xf45642})
  material.opacity = 0.5
  material.transparent = true
  let arc = new THREE.Line(geometryArc, material)
  arc.position.x = point.x
  arc.position.y = point.y

  let geometryLine1 = new THREE.Geometry()
  let geometryLine2 = new THREE.Geometry()
  geometryLine1.vertices.push(new THREE.Vector3(point.x, point.y + 2 * radius, 0))
  geometryLine1.vertices.push(new THREE.Vector3(point.x, point.y - 2 * radius, 0))
  geometryLine2.vertices.push(new THREE.Vector3(point.x + 2 * radius, point.y, 0))
  geometryLine2.vertices.push(new THREE.Vector3(point.x - 2 * radius, point.y, 0))
  let line1 = new THREE.Line(geometryLine1, material)
  let line2 = new THREE.Line(geometryLine2, material)

  let bindingPoint = new THREE.Object3D()
  bindingPoint.name = 'BindingPoint'
  bindingPoint.add(line1)
  bindingPoint.add(line2)
  bindingPoint.add(arc)
  let helpLayer = scene.getObjectByName('HelpLayer')
  if (helpLayer) helpLayer.add(bindingPoint)
}

let removeBindingView = (scene) => {
  let pointScene = scene.getObjectByName('BindingPoint')
  if (pointScene) {
    pointScene.parent.remove(pointScene)
  }
}

let midline = (pointMouse, line, entrainment = 0.5) => {
  let midPoint
  if (line.geometry instanceof THREE.CircleGeometry) {
    const angle = line.geometry.parameters.thetaStart + line.geometry.parameters.thetaLength / 2
    midPoint = {
      x: line.position.x + line.geometry.parameters.radius * Math.cos(angle),
      y: line.position.y + line.geometry.parameters.radius * Math.sin(angle)
    }
  } else if (line.geometry instanceof THREE.Geometry) {
    midPoint = {
      x: (line.geometry.vertices[0].x + line.geometry.vertices[1].x) / 2,
      y: (line.geometry.vertices[0].y + line.geometry.vertices[1].y) / 2
    }
  }

  if (midPoint && isPoint(pointMouse, entrainment, midPoint)) {
    return midPoint
  }
}

let alignment = (pointMouse, scene, entrainment = 0.5) => {
  let result
  sceneService.removeLineByName('AlignmentLine', scene)

  let box = new THREE.BoxHelper(scene, 0xffff00)
  const radius = Number((box.geometry.boundingSphere.radius).toFixed(0))

  let material = new THREE.LineBasicMaterial({color: 0x94e54e})
  material.opacity = 0.5
  material.transparent = true

  let geometryLine1 = new THREE.Geometry()
  let geometryLine2 = new THREE.Geometry()
  geometryLine1.vertices.push(new THREE.Vector3(pointMouse.x, pointMouse.y + 2 * radius, 0))
  geometryLine1.vertices.push(new THREE.Vector3(pointMouse.x, pointMouse.y - 2 * radius, 0))
  geometryLine2.vertices.push(new THREE.Vector3(pointMouse.x + 2 * radius, pointMouse.y, 0))
  geometryLine2.vertices.push(new THREE.Vector3(pointMouse.x - 2 * radius, pointMouse.y, 0))
  let lineOy = new THREE.Line(geometryLine1, material)
  let lineOx = new THREE.Line(geometryLine2, material)

  let closestIntersectPoint = (scene, line, point, entrainment) => {
    let returnPoint
    let intersect = []
    let intersects = (scene, line, point, entrainment) => {
      scene.children.forEach(object => {
        if (!object.children.length) {
          if (object.geometry instanceof THREE.CircleGeometry && object.parent.name !== 'BindingPoint') {
            const check = GeometryUtils.lineArcIntersectNew(lineOy, object, 0)
            if (check.isIntersects && check.type === 'intersect') {
              check.points.forEach(item => {
                item.line = object
                item.distance = GeometryUtils.getDistance(point, item.point)
                intersect.push(item)
              })
            }

          } else if (object.geometry instanceof THREE.Geometry && object.parent.name !== 'BindingPoint') {
            const check = GeometryUtils.linesIntersect(
              object.geometry.vertices[0],
              object.geometry.vertices[1],
              line.geometry.vertices[0],
              line.geometry.vertices[1],
              entrainment
            )
            if (check.isIntersects && check.type === 'intersecting') {
              check.points.forEach(item => {
                item.line = object
                item.distance = GeometryUtils.getDistance(point, item.point)
                intersect.push(item)
              })
            }
          }
        } else {
          intersects(object, line, point, entrainment)
        }
      })
    }
    intersects(scene, line, point, entrainment)

    if (intersect.length) {
      let compare = (a, b) => {
        if (a.distance > b.distance) return 1
        if (a.distance < b.distance) return -1
      }
      intersect.sort(compare)
      if (intersect[0].line.geometry instanceof THREE.CircleGeometry) {
        returnPoint = {
          line: intersect[0].line,
          point: new THREE.Vector3(intersect[0].point.x, intersect[0].point.y, 0)
        }
      } else if (intersect[0].line.geometry instanceof THREE.Geometry) {
        const p = choseLinePoint(intersect[0].point, intersect[0].line, entrainment)
        if (p) {
          returnPoint = {
            line: intersect[0].line,
            point: p
          }
        }
      }
    }
    return returnPoint
  }

  let alignmentLine = new THREE.Object3D()
  alignmentLine.name = 'AlignmentLine'

  let pointOx = closestIntersectPoint(scene, lineOx, pointMouse, entrainment)
  if (pointOx) {
    result = new THREE.Vector3(pointMouse.x, pointOx.point.y, 0)
    lineOx.geometry.vertices[0] = pointOx.point
    lineOx.geometry.vertices[1] = result
    alignmentLine.add(lineOx)
  }

  const pointOy = closestIntersectPoint(scene, lineOy, pointMouse, entrainment)
  if (pointOy) {
    if (result instanceof THREE.Vector3 && pointOx.line !== pointOy.line) {
      result.x = pointOy.point.x
    } else {
      result = new THREE.Vector3(pointOy.point.x, pointMouse.y, 0)
    }
    lineOy.geometry.vertices[0] = pointOy.point
    lineOy.geometry.vertices[1] = result
    alignmentLine.add(lineOy)
  }

  if (alignmentLine.children.length) {
    let helpLayer = scene.getObjectByName('HelpLayer')
    helpLayer.add(alignmentLine)
  }
  return result
}