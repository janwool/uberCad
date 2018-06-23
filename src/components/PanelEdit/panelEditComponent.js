import React, { Component } from 'react'
// import PropTypes from 'prop-types'
import './PanelEdit.css'
import PropTypes from 'prop-types'

export default class PanelEditComponent extends Component {

  newLine = () => {
    if (this.props.editMode.editObject.id) this.props.newLine()
  }

  cancelNewLine = () => {
    this.props.cancelNewLine(this.props.editor)
  }

  newCurve = () => {
    if (this.props.editMode.editObject.id) this.props.newCurve()
  }

  cancelNewCurve = () => {
    this.props.cancelNewCurve(this.props.editor)
  }

  deleteLine = () => {
    this.props.deleteLine(this.props.editor, this.props.editMode.activeLine)
  }

  clone = () => {
    this.props.cloneActive(true)
  }
  cancelClone = () => {
    this.props.cancelClone(this.props.editor, this.props.editMode.clone.cloneObject)
  }

  render () {
    const {activeLine, isNewLine, isNewCurve} = this.props.editMode
    const clone = this.props.editMode.clone.active
    return (
      <div id='panel-edit'>
        <div className='content'>
          <h5>Title: {this.props.editMode.editObject.name}</h5>
          {activeLine.uuid && <div className='line'>
            Active line: {activeLine.uuid}
            <button className='del-line' onClick={this.deleteLine} title='Delete line'/>
          </div>}
          {activeLine.geometry && (activeLine.geometry.type === 'CircleGeometry' &&
            <div>
              <div>radius: {activeLine.geometry.parameters.radius}</div>
              <div>thetaLength: {activeLine.geometry.parameters.thetaLength}</div>
              <div>thetaStart: {activeLine.geometry.parameters.thetaStart}</div>
            </div>)}
        </div>

        <div className='toolbar'>
          {!isNewLine ? <button className='new-line' title='New line' onClick={this.newLine}/>
            : <button className='new-line active' title='Cancel new line' onClick={this.cancelNewLine}/>
          }
          {!isNewCurve ? <button onClick={this.newCurve} className='new-curve ' title='New curve'/>
            : <button onClick={this.cancelNewCurve} className='new-curve active' title='Cencel new curve'/>
          }
          {!clone ? <button onClick={this.clone} className='clone' title='Clone object' />
            : <button onClick={this.cancelClone} className='clone active' title='Cancel clone object' />
          }
        </div>
      </div>
    )
  }

  static propTypes = {
    editMode: PropTypes.object,
    editor: PropTypes.object
  }
}
