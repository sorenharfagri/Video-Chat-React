import React, { Component } from "react";

//Данный компонент отвечает за 1 трансляцую
//Компонент будет добавляться по мере подключения пиров в комнату

class Video extends Component {
  constructor(props) {
      super(props)
      this.state={}
    }

    componentDidMount() {
      if (this.props.videoStream) {

        //Подрубаем стрим
        this.video.srcObject = this.props.videoStream
      }
    }


    componentWillReceiveProps(nextProps) {
      console.log(nextProps.videoStream);
      
      //Если получаем новый стрим - подключаем его
      if (nextProps.videoStream && nextProps.videoStream !== this.props.videoStream) {
        this.video.srcObject = nextProps.videoStream;
      }
    }

    render() {
        return (
           <div
              style={{ ...this.props.frameStyle }}
           >
               <video
                  id={this.props.id}
                  muted={this.props.muted}
                  autoPlay
                  style={{ ...this.props.videoStyles }}
                  ref={ (ref) => { this.video = ref } }
               ></video>
           </div>
        );
    };
};

export default Video;