import DxfParser from 'dxf-parser';
import { Viewer } from './../services/dxfService';
import sceneService from './../services/sceneService';
import {
  TOOL_LINE,
  TOOL_MEASUREMENT, TOOL_NEW_CURVE,
  TOOL_POINT, TOOL_SELECT
} from '../components/Toolbar/toolbarComponent';
import { SELECT_MODE_NEW } from '../components/Options/optionsComponent';
import { addHelpPoints, getScale, unselectLine } from '../services/editObject';
import { selectionBegin, selectionEnd, selectionUpdate } from './selection';
import {
  radius,centerCurve,
  centerPoint, cloneObject, clonePoint,
  disableMovePoint,
  drawLine,
  firstPoint, moveObject, moveObjectPoint,
  movePoint, saveClone, saveNewCurve,
  saveNewLine,
  savePoint, selectClonePoint, selectMovePoint, selectPoint, setClone,
  startNewLine, thetaLength, thetaStart
} from './edit';
import {
  angleFirstInfo, angleSecondInfo, angleSelectFirstLine, angleSelectSecondLine, eraseAngle, eraseLine,
  lineFirstInfo, lineFirstPoint,
  lineSecondInfo, lineSecondPoint, MEASUREMENT_ANGLE,
  MEASUREMENT_LINE,
  MEASUREMENT_POINT,
  MEASUREMENT_RADIAL,
  pointInfo, pointSelect, radialInfo, radialSelectLine
} from './measurement';
import {
  LINE_PARALLEL,
  LINE_PERPENDICULAR,
  LINE_TANGENT_TO_ARC,
  LINE_TWO_POINT,
  parallelLine,
  parallelLineFirstPoint, parallelLineFirstPointSelect,
  parallelLineSecondPoint, parallelLineSecondPointSelect, parallelLineSelect,
  perpendicularBaseLine,
  perpendicularDraw,
  perpendicularFirstPoint, perpendicularFirstPointSelect, perpendicularLineSelect, perpendicularSecondPointSelect,
  tangentBaseArc, tangentBaseArcSelect,
  tangentLineDraw, tangentLineEnd
} from './line';
import { PANEL_LAYERS_TOGGLE } from './panelLayers';

export const CAD_PARSE_DXF = 'CAD_PARSE_DXF';
export const CAD_DRAW_DXF = 'CAD_DRAW_DXF';
export const CAD_CLICK = 'CAD_CLICK';
export const CAD_DO_SELECTION = 'CAD_DO_SELECTION';
export const CAD_SELECT_LINE = 'CAD_SELECT_LINE';
export const CAD_TOGGLE_VISIBLE = 'CAD_TOGGLE_VISIBLE';
export const CAD_TOGGLE_VISIBLE_LAYER = 'CAD_TOGGLE_VISIBLE_LAYER';
export const CAD_SHOW_ALL = 'CAD_SHOW_ALL';
export const CAD_GROUP_ENTITIES = 'CAD_GROUP_ENTITIES';
export const CAD_COMBINE_EDGE_MODELS = 'CAD_COMBINE_EDGE_MODELS';
export const CAD_EDITMODE_SET_ACTIVE_LINE = 'CAD_EDITMODE_SET_ACTIVE_LINE';
export const CAD_EDITMODE_UNSELECT_ACTIVE_LINE =
  'CAD_EDITMODE_UNSELECT_ACTIVE_LINE';
export const CAD_IS_CHANGED = 'CAD_IS_CHANGED';

export const drawDxf = (data = null, container, snapshot = null) => {
  let cadCanvas = new Viewer(data, container, snapshot);
  let scene = cadCanvas.getScene();
  let camera = cadCanvas.getCamera();
  let renderer = cadCanvas.getRenderer();
  container.appendChild(renderer.domElement);

  /**
   * init
   */

  let editor = {
    scene,
    camera,
    renderer,
    cadCanvas,
    options: {
      threshold: 0.01,
      selectMode: SELECT_MODE_NEW,
      singleLayerSelect: true
    }
  };

  try {
    testExample(editor);
  } catch (e) {
    console.error(e);
  }

  return dispatch =>
    dispatch({
      type: CAD_DRAW_DXF,
      payload: {
        scene,
        camera,
        renderer,
        cadCanvas
      }
    });
};

function testExample(editor) {
  let objectsDraft = [
    // // [191],
    // // [239],
    // [370, 429],
    // // [650, 659],
    // // [544],
    // // [698],
    // // [1154, 1134, 1139],
    // [284],
    // // [494],
    // // [741],
    // // [1025],
    // // [773, 825],
    // // [878, 960],
    //
    // // [97, 92, 87],
    // // [1117, 1098, 1086],
    // [316, 463, -1043, -1042, -1041, -1083, -1081, -1080, -1079, -1078, -1077, -1076, -1075, -1074, -1073, -1072, -1071, -1070, -1069, -1068, -1067, -1066, -1065, -1064, -1062, -1061, -1060, -1059, -1058, -1057, -1056, -1055, -1054, -1053, -1052, -1051, -1050, -1049, -1048, -1047, -1046, -1045, -1044, -1082, -1063],
    // [1080],
    // [138, 173, 163],
    // [49, 46, 80, -1037, -1038, -1039, -1040],
    // [1038]
  ];
  let idsToFind = [];
  objectsDraft.forEach(entityContainer =>
    idsToFind.push(...entityContainer.map(id => Math.abs(id)))
  );
  let result = {};

  let iterator = sceneService.entityIterator(editor.scene);
  let entity = iterator.next();
  while (!entity.done) {
    if (idsToFind.indexOf(entity.value.id) >= 0) {
      result[entity.value.id] = entity.value;
    }
    entity = iterator.next();
  }

  let frames = [];

  objectsDraft.forEach((frameData, frameId) => {
    let entities = [];
    editor.options.selectMode = SELECT_MODE_NEW;

    frameData.forEach(entityId => {
      if (entityId < 0) {
        entities.splice(entities.indexOf(result[Math.abs(entityId)]), 1);
      } else {
        entities = [
          ...entities,
          ...sceneService.recursiveSelect(result[entityId], editor)
        ];
        // console.error(entities.map(e => e.id))
      }
    });

    sceneService.highlightEntities(editor, entities);
    frames.push(
      sceneService.groupEntities(editor, entities, `Frame${frameId + 1}`)
    );
  });

  if (frames.length) {
    // let {svg} = sceneService.combineEdgeModels(editor)
    // try {
    //   sceneService.sendToFlixo(svg)
    // } catch (e) {
    //   console.error(e)
    // }
    // let svg = sceneService.someSvg
    // try {
    //   sceneService.sendToFlixo(svg)
    // } catch (e) {
    //   console.error(e)
    // }
  }

  // let svg = sceneService.someSvg
  // try {
  //   sceneService.sendToFlixo(svg)
  // } catch (e) {
  //   console.error(e)
  // }
}

export const cadClick = (event, editor) => {
  return dispatch => {
    let { scene, camera, tool, renderer } = editor;

    switch (tool) {
      case TOOL_POINT:
        {
          let clickResult = sceneService.onClick(event, scene, camera);
          console.log(
            `Click position [${clickResult.point.x.toFixed(
              4
            )}, ${clickResult.point.y.toFixed(4)}]`,
            clickResult
          );

          let payload = {
            ...clickResult,
            object: null
          };

          let selectResult = clickResult.activeEntities;
          // $scope.editor.lastClickResult.activeEntities = ArrayUtils.clone(clickResult.activeEntities);

          if (selectResult.length) {
            // check if entity belongs to object
            if (selectResult[0].userData.belongsToObject) {
              payload.object = selectResult[0].parent;
            }
          }

          if (!editor.editMode.isEdit) {
            let activeEntities = sceneService.doSelection(selectResult, editor);
            dispatch({
              type: CAD_DO_SELECTION,
              payload: {
                activeEntities
              }
            });


          } else { //todo є резон перемістити в scene service окремою функцією doSelection_EditMod, починаючи звідси
            console.log("Start the party");
            console.log(editor.editMode);
            console.log(selectResult);
            if (
              selectResult.length &&
              selectResult[0].parent.name === editor.editMode.editObject.name &&
              !editor.editMode.isNewLine &&
              !editor.editMode.isNewCurve &&
              !editor.editMode.clone.active &&
              !editor.editMode.move.active
            ) {
              if (selectResult[0].id !== editor.editMode.activeLine.id) {
                // if (editor.editMode.activeLine.id) {
                //   unselectLine(editor.editMode.activeLine, scene);
                // }
                // console.log(editor.editMode.activeLine);

                let activeEntities = sceneService.doSelection(
                  selectResult,
                  editor
                );
                dispatch({
                  type: CAD_DO_SELECTION,
                  payload: {
                    activeEntities
                  }
                });

                // console.log("we need more console.log or cad active entities");
                // console.log(activeEntities);
                // console.log(editor);
                // debugger;

                const rPoint = getScale(camera);
                // activeEntities.forEach(element => {
                //   element.name = 'ActiveLine';
                  addHelpPoints(editor, scene, rPoint);

                // });
                dispatch({
                  type: CAD_EDITMODE_SET_ACTIVE_LINE,
                  payload: {
                    activeLine: editor.activeEntities[0]
                  }
                });
                // console.log(activeEntities);
                // debugger;

                renderer.render(scene, camera);
                // dispatch({
                //   type: CAD_EDITMODE_SET_ACTIVE_LINE,
                //   payload: {
                //     activeLine: activeEntities[0]
                //   }
                // });
              }
            } else {
              //unselect activeLine line
              if (
                editor.editMode.activeLine.id &&
                editor.editMode.activeLine !== editor.editMode.editObject
              ) {
                unselectLine(editor.editMode.activeLine, scene);
                renderer.render(scene, camera);
                dispatch({
                  type: CAD_EDITMODE_UNSELECT_ACTIVE_LINE,
                  payload: {
                    activeLine: {}
                  }
                });
              }
            }
            //todo закінчуючи туточки
          }
          // else {
          //   if (clickResult.activeEntities.length > 0 &&
          //     !$scope.editor.editMode.activeLine.hasOwnProperty('id') &&
          //     !$scope.editor.editMode.newLine.active &&
          //     !$scope.editor.editMode.newArc.active&&
          //     (clickResult.activeEntities[0].parent.uuid === $scope.editor.editMode.uuid ||
          //       clickResult.activeEntities[0].uuid === $scope.editor.editMode.uuid)
          //   ) {
          //     $scope.editGeometry(clickResult.activeEntities[0]);
          //   } else {
          //     //do nothing
          //   }
          // }

          // console.log('Click RESULT', clickResult)

          dispatch({
            type: CAD_CLICK,
            payload
          });
        }
        break;

      //todo не булоб логічно сюди перенести і інструмент TOOL_SELECT?

      case TOOL_MEASUREMENT:
        {
          let clickResult = sceneService.onClick(event, scene, camera);
          console.log(
            `Click position [${clickResult.point.x.toFixed(
              4
            )}, ${clickResult.point.y.toFixed(4)}]`,
            clickResult
          );
        }
        break;
      case TOOL_LINE:
        {
          let clickResult = sceneService.onClick(event, scene, camera);
          console.log(
            `Click position [${clickResult.point.x.toFixed(
              4
            )}, ${clickResult.point.y.toFixed(4)}]`,
            clickResult
          );
        }
        break;

      case TOOL_SELECT:
      {
        // ТУТ ТВОРИТЬСЯ ЯКАСЬ МАГІЯ.... Не питай я сам в шоці. а якщо серйозно дублірується код з кейса TOOL_POINT тому можна подумати над виведенням свпільної функції даби не дублювати код
        // let selectResult = editor.activeEntities;
        // if (editor.editMode.isEdit) {
        //   if (
        //     selectResult.length &&
        //     selectResult[0].parent.name === editor.editMode.editObject.name &&
        //     !editor.editMode.isNewLine &&
        //     !editor.editMode.isNewCurve &&
        //     !editor.editMode.clone.active &&
        //     !editor.editMode.move.active
        //   ) {
        //     if (selectResult[0].id !== editor.editMode.activeLine.id) {
        //       let activeEntities = sceneService.doSelection(
        //         selectResult,
        //         editor
        //       );
        //       dispatch({
        //         type: CAD_DO_SELECTION,
        //         payload: {
        //           activeEntities
        //         }
        //       });
        //       const rPoint = getScale(camera);
        //       addHelpPoints(editor, scene, rPoint);
        //       dispatch({
        //         type: CAD_EDITMODE_SET_ACTIVE_LINE,
        //         payload: {
        //           activeLine: editor.activeEntities[0]
        //         }
        //       });
        //       renderer.render(scene, camera);
        //     }
        //   } else {
        //     //unselect activeLine line
        //     debugger;
        //     if (
        //       editor.editMode.activeLine.id &&
        //       editor.editMode.activeLine !== editor.editMode.editObject
        //     ) {
        //       unselectLine(editor.editMode.activeLine, scene);
        //       renderer.render(scene, camera);
        //       dispatch({
        //         type: CAD_EDITMODE_UNSELECT_ACTIVE_LINE,
        //         payload: {
        //           activeLine: {}
        //         }
        //       });
        //     }
        //   }
        // }
        // console.log('in TOOL_SELECT');
        //
          //
          // // end select
          //
          //
          // // if (editor.selection.active) {
          //   let drawRectangle = selectionEnd(event, editor)(dispatch);
          //   let selectResult = sceneService.selectInFrustum(
          //     drawRectangle,
          //     editor.scene
          //   );
          //
          //
          //   // debugger;
          //   let activeEntities = sceneService.doSelection(selectResult, editor);
          //   dispatch({
          //     type: CAD_DO_SELECTION,
          //     payload: {
          //       activeEntities
          //     }
          //   });
          //
        //
        //
        // console.log(editor);
        //
        // if (editor.activeEntities) {
        //
        //   const rPoint = getScale(camera);
        //   addHelpPoints(editor, scene, rPoint);
        //
        //   // dispatch({
        //   //   type: CAD_DO_SELECTION,
        //   //   payload: {
        //   //     activeLine: editor.activeEntities
        //   //   }
        //   // });
        //
        //   // dispatch({
        //   //   type: CAD_EDITMODE_SET_ACTIVE_LINE,
        //   //   payload: {
        //   //     activeLine: editor.activeEntities[0]
        //   //   }
        //   // });
        //   // renderer.render(scene, camera);
        //   // // }
        //
        // }
        //
        //
        // if (editor.selection.active) {
          // let drawRectangle = selectionEnd(event, editor)(dispatch);
          // let selectResult = sceneService.selectInFrustum(
          //   drawRectangle,
          //   editor.scene
          // );
          // // debugger;
          // let activeEntities = sceneService.doSelection(selectResult, editor);
          // dispatch({
          //   type: CAD_DO_SELECTION,
          //   payload: {
          //     activeEntities
          //   }
          // });
          //
          // let { scene, camera, renderer } = editor;
          //
          // const rPoint = getScale(camera);
          // addHelpPoints(editor, scene, rPoint);
          // dispatch({
          //   type: CAD_EDITMODE_SET_ACTIVE_LINE,
          //   payload: {
          //     activeLine: editor.activeEntities[0]
          //   }
          // });
          // renderer.render(scene, camera);
        // }
      }
        break;

      default:
        //todo p.s. TOOL_SELECT сюди всерівно потрапляє
        console.log(`cadClick not handled for tool: ${tool}`);
        break;
    }
  };
};

export const cadonMouseDown = (event, editor) => {
  return dispatch => {
    let { scene, camera, tool, renderer } = editor;
    if (event.button === 0) {

      //new line
      if (editor.editMode.isNewLine) {
        !editor.editMode.newLineFirst
          ? firstPoint(event, editor)(dispatch)
          : saveNewLine(editor)(dispatch);
      }
      //new curve
      if (editor.editMode.isNewCurve) {
        if (!editor.editMode.newCurveCenter) {
          centerPoint(event, editor)(dispatch);
        } else if (!editor.editMode.thetaStart) {
          thetaStart(editor)(dispatch);
        } else if (!editor.editMode.thetaLength) {
          saveNewCurve(editor)(dispatch);
        }
      }
      //clone object
      if (editor.editMode.clone.active) {
        if (!editor.editMode.clone.point) {
          clonePoint(event, editor)(dispatch);
          cloneObject(editor, editor.editMode.editObject)(dispatch);
        } else if (editor.editMode.clone.cloneObject) {
          saveClone(editor.editMode.clone.cloneObject)(dispatch);
        }
      }

      //move object
      if (editor.editMode.move.active && !editor.editMode.move.point) {
        moveObjectPoint(event, editor)(dispatch);
      }


      switch (tool) {
        case TOOL_NEW_CURVE: {
          if (!editor.editMode.newCurveCenter) {
            centerPoint(event, editor)(dispatch);
          } else if (!editor.editMode.thetaStart) {
            thetaStart(editor)(dispatch);
          } else if (!editor.editMode.thetaLength) {
            saveNewCurve(editor)(dispatch);
          }
        }
          break;
        case TOOL_POINT: {
          if (editor.editMode.isEdit) {
            // do edit here
            if (editor.editMode.activeLine.id) {
              selectPoint(editor.editMode.activeLine, event, editor)(dispatch);
            }
          }
        }
          break;
        case TOOL_MEASUREMENT: {
          if (editor.options.selectMode === MEASUREMENT_POINT) {
            pointSelect(event, editor)(dispatch);
          } else if (editor.options.selectMode === MEASUREMENT_LINE) {
            if (
              editor.measurement.line.first &&
              editor.measurement.line.second
            ) {
              eraseLine()(dispatch);
            } else {
              !editor.measurement.line.first
                ? lineFirstPoint(event, editor)(dispatch)
                : lineSecondPoint(
                event,
                editor,
                editor.measurement.line.first
                )(dispatch);
            }
          } else if (editor.options.selectMode === MEASUREMENT_RADIAL) {
            radialSelectLine(editor.activeEntities[0])(dispatch);
          } else if (editor.options.selectMode === MEASUREMENT_ANGLE) {
            if (
              editor.measurement.angle.firstLine &&
              editor.measurement.angle.secondLine
            ) {
              eraseAngle()(dispatch);
            } else {
              !editor.measurement.angle.firstLine
                ? angleSelectFirstLine(editor.activeEntities[0])(dispatch)
                : angleSelectSecondLine(
                editor.measurement.angle.firstLine,
                editor.activeEntities[0]
                )(dispatch);
            }
          }
        }
          break;
        case TOOL_SELECT: {
          selectionBegin(event, editor)(dispatch);
        }
          break;
        case TOOL_LINE: {
          if (editor.options.selectMode === LINE_TWO_POINT) {
            console.log(LINE_TWO_POINT, 'mouse down');
            !editor.editMode.newLineFirst
              ? firstPoint(event, editor)(dispatch)
              : saveNewLine(editor)(dispatch);
          } else if (editor.options.selectMode === LINE_PARALLEL) {
            if (!editor.line.parallel.baseLine) {
              parallelLineSelect(editor.activeEntities[0])(dispatch);
            } else if (!editor.line.parallel.firstPoint) {
              parallelLineFirstPointSelect(
                event,
                editor,
                editor.line.parallel.baseLine
              )(dispatch);
            } else {
              parallelLineSecondPointSelect(event, editor)(dispatch);
            }
          } else if (editor.options.selectMode === LINE_PERPENDICULAR) {
            if (!editor.line.perpendicular.baseLine) {
              perpendicularLineSelect(editor.activeEntities[0])(dispatch);
            } else if (!editor.line.perpendicular.firstPoint) {
              perpendicularFirstPointSelect(event, editor)(dispatch);
            } else {
              perpendicularSecondPointSelect(event, editor)(dispatch);
            }
          } else if (editor.options.selectMode === LINE_TANGENT_TO_ARC) {
            if (!editor.line.tangent.baseArc) {
              tangentBaseArcSelect(editor.activeEntities[0])(dispatch);
            } else {
              tangentLineEnd(event, editor)(dispatch);
            }
          }
        }
          break;
        default:
          console.log(`cadonMouseDown not handled for tool: ${tool}`);
          break;
      }
    }
  };
};

export const cadonMouseUp = (event, editor) => {
  return dispatch => {
    let { scene, camera, tool, renderer } = editor;

    //move object
    if (editor.editMode.move.active && editor.editMode.move.point) {
      disableMovePoint(editor.editMode.move.moveObject)(dispatch);
    }

    console.log(editor);
    // debugger;

    switch (tool) {
      case TOOL_SELECT: {
        // end select
        if (editor.selection.active) {
          let drawRectangle = selectionEnd(event, editor)(dispatch);
          let selectResult = sceneService.selectInFrustum(
            drawRectangle,
            editor.scene
          );

          let selectResultInEditObject = [];

          if (!editor.editMode.isEdit) {
            selectResultInEditObject = selectResult;
          } else {
            // todo елементи які відносоться тільки до редагуємого обєкту
            selectResult.forEach( element => {
              if (element.parent.name === editor.editMode.editObject.name) {
                // debugger;
                selectResultInEditObject.push(element);
              }
            });

            let activeEntities = sceneService.doSelection(selectResultInEditObject, editor);
            dispatch({
              type: CAD_DO_SELECTION,
              payload: {
                activeEntities
              }
            });

            let { scene, camera, renderer } = editor;
            // console.log(selectResult);
            // debugger;
            // debugger;
            // let activeEntities = sceneService.doSelection(
            //   selectResult,
            //   editor
            // );
            // dispatch({
            //   type: CAD_DO_SELECTION,
            //   payload: {
            //     activeEntities
            //   }
            // });
            // dispatch({
            //   type: CAD_EDITMODE_SET_ACTIVE_LINE,
            //   payload: {
            //     activeLine: editor.activeEntities[0]
            //   }
            // });
            renderer.render(scene, camera);
            // debugger;
            if(selectResult.length!==0) {
              // debugger;
              if (selectResult[0].id !== editor.editMode.activeLine.id) {
                // debugger;
                // let activeEntities = sceneService.doSelection(
                //   selectResult,
                //   editor
                // );
                // dispatch({
                //   type: CAD_DO_SELECTION,
                //   payload: {
                //     activeEntities
                //   }
                // });
                // debugger;

                const rPoint = getScale(camera);
                addHelpPoints(editor, scene, rPoint);
                // dispatch({
                //   type: CAD_EDITMODE_SET_ACTIVE_LINE,
                //   payload: {
                //     activeLine: editor.activeEntities[0]
                //   }
                // });

                renderer.render(scene, camera);
              }
            }
          }
        }
        // todo ТУТ ТВОРИТЬСЯ ЯКАСЬ МАГІЯ.... Не питай я сам в шоці. а якщо серйозно дублірується код з кейса TOOL_POINT тому можна подумати над виведенням свпільної функції даби не дублювати код
        // if (editor.editMode.isEdit) {
        //   if (
        //     selectResult.length &&
        //     selectResult[0].parent.name === editor.editMode.editObject.name &&
        //     !editor.editMode.isNewLine &&
        //     !editor.editMode.isNewCurve &&
        //     !editor.editMode.clone.active &&
        //     !editor.editMode.move.active
        //   ) {
        //     if (selectResult[0].id !== editor.editMode.activeLine.id) {
        //       let activeEntities = sceneService.doSelection(
        //         selectResult,
        //         editor
        //       );
        //       dispatch({
        //         type: CAD_DO_SELECTION,
        //         payload: {
        //           activeEntities
        //         }
        //       });
        //       const rPoint = getScale(camera);
        //       addHelpPoints(editor, scene, rPoint);
        //       dispatch({
        //         type: CAD_EDITMODE_SET_ACTIVE_LINE,
        //         payload: {
        //           activeLine: editor.activeEntities[0]
        //         }
        //       });
        //       renderer.render(scene, camera);
        //     }
        //   } else {
        //     //unselect activeLine line
        //     debugger;
        //     if (
        //       editor.editMode.activeLine.id &&
        //       editor.editMode.activeLine !== editor.editMode.editObject
        //     ) {
        //       unselectLine(editor.editMode.activeLine, scene);
        //       renderer.render(scene, camera);
        //       dispatch({
        //         type: CAD_EDITMODE_UNSELECT_ACTIVE_LINE,
        //         payload: {
        //           activeLine: {}
        //         }
        //       });
        //     }
        //   }
        // }
        // console.log('in TOOL_SELECT');
        //
        //
        // // end select
        //
        //
        // // if (editor.selection.active) {
        //   let drawRectangle = selectionEnd(event, editor)(dispatch);
        //   let selectResult = sceneService.selectInFrustum(
        //     drawRectangle,
        //     editor.scene
        //   );
        //
        //
        //   // debugger;
        //   let activeEntities = sceneService.doSelection(selectResult, editor);
        //   dispatch({
        //     type: CAD_DO_SELECTION,
        //     payload: {
        //       activeEntities
        //     }
        //   });
        //
        //
        //
        // console.log(editor);
        //
        // if (editor.activeEntities) {
        //
        //   const rPoint = getScale(camera);
        //   addHelpPoints(editor, scene, rPoint);
        //
        //   // dispatch({
        //   //   type: CAD_DO_SELECTION,
        //   //   payload: {
        //   //     activeLine: editor.activeEntities
        //   //   }
        //   // });
        //
        //   // dispatch({
        //   //   type: CAD_EDITMODE_SET_ACTIVE_LINE,
        //   //   payload: {
        //   //     activeLine: editor.activeEntities[0]
        //   //   }
        //   // });
        //   // renderer.render(scene, camera);
        //   // // }
        //
        // }


      }
        break;
      case TOOL_POINT: {
        if (
          event.button === 0 &&
          editor.editMode.isEdit &&
          editor.editMode.activeLine.id
        ) {
          // do edit here
          savePoint(editor.editMode.selectPointIndex)(dispatch);
        }
      }
        break;
      default:
        console.log(`cadonMouseUp not handled for tool: ${tool}`);
        break;
    }

  };
};

export const cadonMouseMove = (event, editor) => {
  return dispatch => {
    let { scene, camera, tool, renderer } = editor;

    //new Line
    if (editor.editMode.isNewLine) {
      let parent = editor.editMode.editObject;
      if (!parent || parent.metadata) {
        parent = editor.scene.getObjectByName('Layers').children[0];
        dispatch({
          type: PANEL_LAYERS_TOGGLE,
          payload: {
            activeLayer: parent
          }
        });
      }
      !editor.editMode.newLineFirst
        ? startNewLine(event, editor)(dispatch)
        : drawLine(event, editor, parent)(dispatch);
    }
    //new Curve
    if (editor.editMode.isNewCurve) {
      let parent =
        editor.tool === TOOL_NEW_CURVE
          ? editor.activeLayer
          : editor.editMode.editObject;
      if (!parent || parent.metadata) {
        parent = editor.scene.getObjectByName('Layers').children[0];
        dispatch({
          type: PANEL_LAYERS_TOGGLE,
          payload: {
            activeLayer: parent
          }
        });
      }

      if (!editor.editMode.newCurveCenter) {
        centerCurve(event, editor)(dispatch);
      } else if (!editor.editMode.thetaStart) {
        radius(event, editor)(dispatch);
      } else if (!editor.editMode.thetaLength) {
        thetaLength(event, editor, parent)(dispatch);
      }
    }
    //clone object
    if (editor.editMode.clone.active) {
      selectClonePoint(event, editor)(dispatch);
      if (editor.editMode.clone.point && editor.editMode.clone.cloneObject) {
        setClone(event, editor)(dispatch);
      }
    }
    //move object
    if (editor.editMode.move.active) {
      selectMovePoint(event, editor)(dispatch);
      if (editor.editMode.move.point && editor.editMode.move.moveObject) {
        moveObject(event, editor)(dispatch);
      }
    }

    switch (tool) {

      case TOOL_SELECT: {
        if (editor.selection.active) {
          selectionUpdate(event, editor)(dispatch);
        }
      }
        break;

      case TOOL_POINT: {
        if (
          event.button === 0 &&
          editor.editMode.isEdit &&
          editor.editMode.activeLine.id &&
          (editor.editMode.selectPointIndex ||
            editor.editMode.selectPointIndex === 0)
        ) {
          // do edit here
          console.log(editor.editMode);
          console.log(event.button);
          console.log(editor.editMode.selectPointIndex);
          // debugger;
          movePoint(
            editor.editMode.activeLine,
            editor.editMode.selectPointIndex,
            event,
            editor
          )(dispatch);
        }
      }
        break;

      case TOOL_MEASUREMENT: {
        // if (editor.tool === TOOL_MEASUREMENT) {
        if (editor.options.selectMode === MEASUREMENT_POINT) {
          pointInfo(event, editor)(dispatch);
        } else if (editor.options.selectMode === MEASUREMENT_LINE) {
          if (!editor.measurement.line.first) {
            lineFirstInfo(event, editor)(dispatch);
          } else if (!editor.measurement.line.second) {
            lineSecondInfo(event, editor)(dispatch);
          }
        } else if (editor.options.selectMode === MEASUREMENT_RADIAL) {
          radialInfo(event, editor)(dispatch);
        } else if (editor.options.selectMode === MEASUREMENT_ANGLE) {
          if (!editor.measurement.angle.firstLine) {
            angleFirstInfo(event, editor)(dispatch);
          } else if (!editor.measurement.angle.secondLine) {
            angleSecondInfo(
              event,
              editor,
              editor.measurement.angle.firstLine
            )(dispatch);
          }
        }
        // }
      }
        break;

      case TOOL_LINE: {
        // if (editor.tool === TOOL_LINE) {
        switch (editor.options.selectMode) {
          case LINE_TWO_POINT: {
            let parent =
              editor.tool === TOOL_LINE
                ? editor.activeLayer
                : editor.editMode.editObject;
            if (!parent || parent.metadata) {
              parent = editor.scene.getObjectByName('Layers').children[0];
              dispatch({
                type: PANEL_LAYERS_TOGGLE,
                payload: {
                  activeLayer: parent
                }
              });
            }
            !editor.editMode.newLineFirst
              ? startNewLine(event, editor)(dispatch)
              : drawLine(event, editor, parent)(dispatch);
          }
            break;
          case LINE_PARALLEL:
            if (!editor.line.parallel.baseLine) {
              parallelLine(event, editor)(dispatch);
            } else if (!editor.line.parallel.firstPoint) {
              parallelLineFirstPoint(event, editor)(dispatch);
            } else {
              parallelLineSecondPoint(
                event,
                editor,
                editor.line.parallel.baseLine,
                editor.line.parallel.firstPoint,
                editor.line.parallel.distance
              )(dispatch);
            }

            break;
          case LINE_PERPENDICULAR:
            if (!editor.line.perpendicular.baseLine) {
              perpendicularBaseLine(event, editor)(dispatch);
            } else if (!editor.line.perpendicular.firstPoint) {
              perpendicularFirstPoint(event, editor)(dispatch);
            } else {
              perpendicularDraw(
                event,
                editor,
                editor.line.perpendicular.baseLine,
                editor.line.perpendicular.firstPoint
              )(dispatch);
            }

            break;
          case LINE_TANGENT_TO_ARC:
            if (!editor.line.tangent.baseArc) {
              tangentBaseArc(event, editor)(dispatch);
            } else {
              tangentLineDraw(
                event,
                editor,
                editor.line.tangent.baseArc
              )(dispatch);
            }

            break;
          default: {
            console.error(
              `Unknown editor.options.selectMode = ${editor.options.selectMode}`
            );
          }
        }
        // }
      }
        break;

      case TOOL_NEW_CURVE: {
        let parent =
          editor.tool === TOOL_NEW_CURVE
            ? editor.activeLayer
            : editor.editMode.editObject;
        if (!parent || parent.metadata) {
          parent = editor.scene.getObjectByName('Layers').children[0];
          dispatch({
            type: PANEL_LAYERS_TOGGLE,
            payload: {
              activeLayer: parent
            }
          });
        }
      }
        break;

      default:

        console.log(`cadonMouseMove not handled for tool: ${tool}`);
        break;
    }
  };
};

export const cadDoubleClick = (event, editor) => {
  return dispatch => {
    let { scene, camera, tool } = editor;

    // console.warn('Double click: TODO recursive select entities')

    switch (tool) {
      case TOOL_POINT:
        if (!editor.editMode.isEdit) {
          let clickResult = sceneService.onClick(event, scene, camera);
          console.log(
            `DOUBLE Click position [${clickResult.point.x.toFixed(
              4
            )}, ${clickResult.point.y.toFixed(4)}]`,
            clickResult
          );

          if (clickResult.activeEntities.length) {
            console.log('has active entities');
            // check if entity belongs to object
            let activeEntities;
            if (clickResult.activeEntities[0].userData.belongsToObject) {
              // completely select object
              // $scope.editor.activeEntities = $scope.editor.activeEntities[0].parent.children;
              activeEntities = clickResult.activeEntities[0].parent.children;
            } else {
              activeEntities = sceneService.recursiveSelect(
                clickResult.activeEntities[0],
                editor
              );
            }

            activeEntities = sceneService.doSelection(activeEntities, editor);
            dispatch({
              type: CAD_DO_SELECTION,
              payload: {
                activeEntities
              }
            });
          }
        }

        break;
      default:
        console.log(`cadDoubleClick not handled for tool: ${tool}`);
        break;
    }
  };
};

export const parseDxf = dxf => {
  let parser = new DxfParser();
  return dispatch =>
    dispatch({
      type: CAD_PARSE_DXF,
      payload: {
        parsedData: parser.parseSync(dxf)
      }
    });
};

export const toggleChanged = isChanged => {
  return dispatch =>
    dispatch({
      type: CAD_IS_CHANGED,
      payload: {
        isChanged: !isChanged
      }
    });
};
