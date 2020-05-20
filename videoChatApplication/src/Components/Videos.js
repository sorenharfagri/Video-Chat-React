import React, { Component } from "react";
import Video from "./Video";
import { v4 as uuidv4 } from "uuid";

//Компонент отвечает за отображение видеотрансляций пользователей, служит контейнером для компонентов Video
//Получает список удалённых трансляций, и на каждую трансляцию выводит компонент "Video"

class Videos extends Component {
    constructor(props){
        super(props)

        this.state = {
            rVideos: [], //Массив компонетов "Video"
            remoteStreams : [] //Список трансляций
        }
    }

    componentWillReceiveProps(nextProps) {
        if(this.props.remoteStreams !== nextProps.remoteStreams) { //Получаем список трансляций
            
            let _rVideos = nextProps.remoteStreams.map( (rVideo) => { //Иттерируемся по полученному списку трансляций
                let video = <Video                                    //На каждую трансляцию создаём элемент "Video"
                videoStream = {rVideo.stream} //Передаём в него стрим
                frameStyle = {{ width: 120, float: "left", padding: "0 3px" }}
                videoStyles={{
                    cursor: "pointer",
                    objectFit: "cover",
                    borderRadius: 3, 
                    width: "100%"
                }}
                />

                //Возвращаем готовый элемент для добавления в контейнер
                return (
                    <div
                       id={rVideo.name}
                       onClick={ () => this.props.switchVideo(rVideo) } //Функция для отображения на экран конкретной трансляции
                       style={{ display: "inline-block" }}
                       key={uuidv4()}
                    >
                       {video}
                    </div>
                )
            })

            this.setState({
                remoteStreams: nextProps.remoteStreams,
                rVideos: _rVideos //Обновляем массив компонентов с трансляциями
            });
        }
    }


    render() {
       return (
          <div          /* Контейнер для трансляций */
             style={{
                 zIndex: 3,
                 position: "fixed",
                 padding: "6px 3px",
                 backgroundColor: "rgba(0,0,0,0.3)",
                 maxHeight: 120,
                 top: "auto",
                 right: 10,
                 left: 10,
                 bottom: 10,
                 overflowX: "scroll",
                 whiteSpace: "nowrap"
                }}
            >
                { this.state.rVideos } {/* Отображаем в контейнере коллекцию трансляций */}
            </div>
       );
    };
};

export default Videos;