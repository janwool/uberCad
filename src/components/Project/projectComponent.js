import React, { Component } from 'react'
import { FormattedMessage } from 'react-intl'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { Row, Col, Button, Modal } from 'react-bootstrap'
import './Project.css'

export default class ProjectComponent extends Component {

  constructor (props) {
    super(props)
    this.state = {
      show: false
    }
  }

  handleClose = () => {
    this.setState({show: false})
  }

  handleShow = () => {
    this.setState({show: true})
  }

  componentDidMount () {
    const {id} = this.props.match.params
    const {preloadedProject} = this.props
    this.props.fetchProject(id, preloadedProject)
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.match.params.id !== this.props.match.params.id) {
      const {id} = nextProps.match.params
      const {preloadedProject} = nextProps
      this.props.fetchProject(id, preloadedProject)
    }
  }

  delProject = () => {
    this.handleClose()
    this.props.delProject(this.props.project._key)
  }

  render () {
    const {project} = this.props
    return (
      <div className='project-page'>
        {project &&
        <div className='head-project'>
          <h3>Project: {project.title}</h3>
          <FormattedMessage id='project.btnDel' defaultMessage='Delete project'>
            {value =>
              <button title={value} className='del-project' onClick={this.handleShow} />
            }
          </FormattedMessage>
        </div>
        }

        <Modal show={this.state.show} onHide={this.handleClose}>
          <Modal.Header >
            <FormattedMessage id='project.delMsg' defaultMessage='Delete project'>
              {value =>
                <Modal.Title>{value}</Modal.Title>
              }
            </FormattedMessage>

          </Modal.Header>
          <Modal.Footer>
            <FormattedMessage id='btn.delete' defaultMessage='Delete'>
              {value =>
                <Button onClick={this.delProject}>{value}</Button>
              }
            </FormattedMessage>
            <FormattedMessage id='btn.cancel' defaultMessage='Cancel'>
              {value =>
                <Button onClick={this.handleClose}>{value}</Button>
              }
            </FormattedMessage>
          </Modal.Footer>
        </Modal>

        {project && (
          <div>
            <Row className='table-head'>
              <Col xs={0} sm={1} className='table-head-name'/>
              <Col xs={3} sm={3} className='hidden-sm-down table-head-name'>
                <FormattedMessage id='project.title' defaultMessage='title!' />
              </Col>
              <Col xs={3} sm={2} className='hidden-sm-down table-head-name'>
                <FormattedMessage id='project.createdBy' defaultMessage='created by' />
              </Col>
              <Col xs={2} sm={2}
                   className='hidden-sm-down table-head-name'>
                <FormattedMessage id='project.rating' defaultMessage='rating' />
                <br/>
                <i>
                  <FormattedMessage id='projects.price' defaultMessage='price' />/
                  <FormattedMessage id='projects.efficiency' defaultMessage='efficiency' />
                </i>
              </Col>
              <Col xs={2} sm={2} className='hidden-sm-down table-head-name'>
                <FormattedMessage id='projects.details' defaultMessage='details' />
              </Col>
              <Col xs={2} sm={2} className='hidden-sm-down table-head-name'>
                <FormattedMessage id='projects.status' defaultMessage='status' />
              </Col>
            </Row>

            {
              project.snapshots.map((snapshot, i) =>
                <Row key={i} className='table-row'>
                  <Col xs={1} className='table-data icon'>
                    <i className='fa fa-cubes fa-eye'/>
                  </Col>
                  <Col xs={3} className='table-data title'>
                    <Link to={`/cad/${project._key}/${snapshot._key}`}>{snapshot.title}</Link>
                    <p>34 minutes ago hardcoded</p>
                  </Col>
                  <Col xs={2} className='table-data'>
                    project - createdBy
                    <p>Project manager hardcoded</p>
                  </Col>

                  <Col xs={2} className='table-data'>rating...</Col>
                  <Col xs={2} className='table-data'>description...</Col>
                  <Col xs={1} className='table-data'>in progress</Col>
                </Row>
              )
            }

            <Row className='table-row'>
              <Col xs={1} className='table-data icon'>
                <i className='fa fa-cubes fa-eye'/>
              </Col>
              <Col xs={3} className='table-data title'>
                <Link to={`/cad/${project._key}`}>{project.title}</Link>
                <p>34 minutes ago hardcoded</p>
              </Col>
              <Col xs={2} className='table-data'>
                project - createdBy
                <p>Project manager hardcoded</p>
              </Col>

              <Col xs={2} className='table-data'>rating...</Col>
              <Col xs={2} className='table-data'>description...</Col>
              <Col xs={1} className='table-data'>in progress</Col>
            </Row>
          </div>)}
      </div>
    )
  }

  static propTypes = {
    // projectsList: PropTypes.object.isRequired,
    loading: PropTypes.bool.isRequired,
    error: PropTypes.object,
    project: PropTypes.object,
    lastUpdated: PropTypes.number
  }
}